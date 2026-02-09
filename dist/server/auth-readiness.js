class AuthReadiness {
    ready = false;
    resolvers = [];
    setReady() {
        this.ready = true;
        this.resolvers.forEach(resolve => resolve());
        this.resolvers = [];
    }
    isReady() {
        return this.ready;
    }
    waitForReady() {
        if (this.ready) {
            return Promise.resolve();
        }
        return new Promise(resolve => {
            this.resolvers.push(resolve);
        });
    }
}
export const authReadiness = new AuthReadiness();
//# sourceMappingURL=auth-readiness.js.map