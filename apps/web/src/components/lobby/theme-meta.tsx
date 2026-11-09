import { cn } from "@mm/ui";
import { CircleCheck, Clock, Gauge, Hourglass, Users } from "lucide-react";
import { DIFFICULTY_LABEL, peopleLabel, type Theme } from "@/lib/theme";

/** 인원 · 시간 · 난이도 배지 묶음 */
export function ThemeBadges({ theme, size }: { theme: Theme; size?: "sm" }) {
  const cls = cn("nm-badge", size === "sm" && "nm-badge--sm");
  const icon = size === "sm" ? 12 : 14;
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={cls}>
        <Users size={icon} aria-hidden /> {peopleLabel(theme)}
      </span>
      <span className={cls}>
        <Clock size={icon} aria-hidden /> {theme.estimatedMinutes}분
      </span>
      <span className={cls}>
        <Gauge size={icon} aria-hidden /> 난이도 {DIFFICULTY_LABEL[theme.difficulty]}
      </span>
    </div>
  );
}

/** 플레이 가능 여부. 색만으로 구분하지 않도록 아이콘과 라벨을 함께 쓴다 */
export function AvailabilityBadge({ theme, size }: { theme: Theme; size?: "sm" }) {
  const icon = size === "sm" ? 12 : 14;
  return theme.scenarioVersionId ? (
    <span className={cn("nm-badge nm-badge--alibi", size === "sm" && "nm-badge--sm")}>
      <CircleCheck size={icon} aria-hidden /> 플레이 가능
    </span>
  ) : (
    <span className={cn("nm-badge", size === "sm" && "nm-badge--sm")}>
      <Hourglass size={icon} aria-hidden /> 준비 중
    </span>
  );
}

/** 바랜 흑백 사진 톤의 표지 이미지 */
export function Cover({
  theme,
  className,
  brightness = 0.82,
}: {
  theme: Theme;
  className?: string;
  brightness?: number;
}) {
  return (
    // biome-ignore lint/performance/noImgElement: 정적 SVG 표지
    <img
      src={theme.coverImage}
      alt=""
      className={cn("absolute inset-0 h-full w-full object-cover", className)}
      style={{
        objectPosition: theme.coverPosition ?? "center",
        filter: `grayscale(.55) sepia(.3) brightness(${brightness})`,
      }}
    />
  );
}
