// Owns one user-triggered judgement request and cancels it when its screen is left.
export function createJudgementRunner({ loadProfile, judge, onLoading, onSuccess, onError, isActive = () => true }) {
  let active = null;
  return {
    get pending() { return active !== null; },
    start() {
      if (active) return active.promise;
      const controller = new AbortController();
      const request = { controller, promise: null };
      active = request;
      onLoading();
      request.promise = (async () => {
        try {
          const profile = await loadProfile();
          if (!isActive() || controller.signal.aborted) return;
          const result = await judge(profile, { signal: controller.signal });
          if (!isActive() || controller.signal.aborted) return;
          onSuccess(result);
        } catch (error) {
          if (!controller.signal.aborted && isActive()) onError(error);
        } finally {
          if (active === request) active = null;
        }
      })();
      return request.promise;
    },
    cancel() {
      if (!active) return false;
      active.controller.abort();
      active = null;
      return true;
    },
  };
}
