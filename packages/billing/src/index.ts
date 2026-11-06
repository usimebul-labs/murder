/**
 * 결제 설계: 상품 → 주문 → 결제 → 이용권(entitlement)
 * 게임 서버와 스튜디오는 결제가 아니라 이용권만 확인한다.
 * 데모 단계는 ManualGrantProvider(관리자 수동 지급)만 사용하고,
 * 이후 PortOneProvider(웹), RevenueCatProvider(앱)를 같은 인터페이스로 추가한다.
 */

export type EntitlementSource = "purchase" | "admin" | "promotion";

export interface EntitlementGrant {
  userId: string;
  productId: string;
  source: EntitlementSource;
  /** null이면 영구 */
  expiresAt: Date | null;
  /** 결제로 지급된 경우 payments.id */
  paymentId?: string;
}

export interface CheckoutRequest {
  userId: string;
  productId: string;
  orderId: string;
  amountKrw: number;
}

export interface CheckoutSession {
  provider: PaymentProviderId;
  /** 클라이언트 SDK에 넘길 값 (예: 포트원 paymentId, storeId) */
  clientParams: Record<string, string>;
}

export interface WebhookResult {
  orderId: string;
  status: "paid" | "failed" | "cancelled" | "refunded";
  providerTxId: string;
  raw: unknown;
}

export type PaymentProviderId = "manual" | "portone" | "revenuecat";

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  /** 결제창을 열기 위한 정보 생성 */
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  /**
   * PG/스토어 웹훅을 검증하고 해석한다.
   * 결제 완료는 클라이언트 응답이 아니라 이 결과로만 확정한다.
   */
  handleWebhook(headers: Record<string, string>, body: string): Promise<WebhookResult>;
}

/** 이용권 저장소. 구현은 web 앱이 DB(@mm/db)로 제공한다. */
export interface EntitlementStore {
  grant(grant: EntitlementGrant): Promise<void>;
  revokeByPayment(paymentId: string): Promise<void>;
  has(userId: string, productId: string, at?: Date): Promise<boolean>;
}

/** 데모용: 결제 없이 관리자가 이용권을 지급한다 */
export class ManualGrantProvider implements PaymentProvider {
  readonly id = "manual" as const;

  async createCheckout(): Promise<CheckoutSession> {
    throw new Error("데모에서는 결제를 지원하지 않습니다. 관리자가 이용권을 지급합니다.");
  }

  async handleWebhook(): Promise<WebhookResult> {
    throw new Error("수동 지급 공급자는 웹훅을 받지 않습니다.");
  }
}

export async function grantByAdmin(
  store: EntitlementStore,
  userId: string,
  productId: string,
  expiresAt: Date | null = null,
): Promise<void> {
  await store.grant({ userId, productId, source: "admin", expiresAt });
}
