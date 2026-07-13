// types/worker.d.ts
declare module '*.worker.ts' {
  class WebpackWorker extends Worker {
    constructor();
  }
  export default WebpackWorker;
}

declare module '*.worker.js' {
  class WebpackWorker extends Worker {
    constructor();
  }
  export default WebpackWorker;
}
