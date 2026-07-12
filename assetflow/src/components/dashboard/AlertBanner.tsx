export interface AlertBannerProps {
  message?: string;
}

export function AlertBanner({ message }: AlertBannerProps) {
  return (
    <div className="flex h-14 items-center rounded-[18px] border border-border-base bg-alert-bg px-5">
      <p className="text-sm font-medium text-red-300">{message}</p>
    </div>
  );
}