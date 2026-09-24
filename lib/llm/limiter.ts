export type Limiter = {
  run<T>(fn: () => Promise<T>): Promise<T>;
};

export function createLimiter(max: number): Limiter {
  let active = 0;
  const queue: Array<() => void> = [];

  const tryRun = () => {
    if (active >= max || queue.length === 0) return;
    const next = queue.shift();
    if (next) next();
  };

  return {
    run<T>(fn: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const execute = () => {
          active += 1;
          Promise.resolve()
            .then(fn)
            .then(resolve, reject)
            .finally(() => {
              active -= 1;
              tryRun();
            });
        };

        if (active < max) {
          execute();
        } else {
          queue.push(execute);
        }
      });
    },
  };
}

export const reportLimiter = createLimiter(3);
export const chatLimiter = createLimiter(20);
