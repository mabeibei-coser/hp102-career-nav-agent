type BipolarBarProps = {
  left: string;
  right: string;
  score: number;
};

export function BipolarBar({ left, right, score }: BipolarBarProps) {
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <div data-testid="bipolar-bar" className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <div className="relative h-2 rounded-full bg-gray-100">
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 shadow"
          style={{ left: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
