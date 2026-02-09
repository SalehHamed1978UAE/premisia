class AuthReadiness {
  private ready = false;
  private resolvers: Array<() => void> = [];

  setReady() {
    this.ready = true;
    this.resolvers.forEach(resolve => resolve());
    this.resolvers = [];
  }

  isReady() {
    return this.ready;
  }

  waitForReady(): Promise<void> {
    if (this.ready) {
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      this.resolvers.push(resolve);
    });
  }
}

export const authReadiness = new AuthReadiness();
