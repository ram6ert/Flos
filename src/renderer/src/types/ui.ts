export enum LoadingState {
  IDLE = "idle",
  LOADING = "loading",
  SUCCESS = "success",
  ERROR = "error"
}

export interface LoadingStateData {
  state: LoadingState;
  error?: string;
  progress?: {
    completed: number;
    total: number;
    currentItem?: string;
  };
}