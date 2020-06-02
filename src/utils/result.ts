export default class Result<T> {
  data: T | Error;
  status: number;

  constructor(data: T | Error, status: number) {
    this.data = data;
    this.status = status;
  }

  isError() {
    return this.data instanceof Error;
  }

  getError() {
    return this.isError() ? this.data as Error : undefined;
  }

  getObject() {
    return this.isError() ? undefined : this.data as T;
  }
  
}