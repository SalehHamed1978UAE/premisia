export class ServiceContainer {
  private services: Map<string, unknown> = new Map();
  private factories: Map<string, () => unknown> = new Map();

  register<T>(name: string, factory: () => T): void {
    this.factories.set(name, factory);
  }

  registerInstance<T>(name: string, instance: T): void {
    this.services.set(name, instance);
  }

  resolve<T>(name: string): T {
    if (this.services.has(name)) {
      return this.services.get(name) as T;
    }

    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Service '${name}' not registered`);
    }

    const instance = factory();
    this.services.set(name, instance);
    return instance as T;
  }

  has(name: string): boolean {
    return this.services.has(name) || this.factories.has(name);
  }

  clear(): void {
    this.services.clear();
  }
}

export const container = new ServiceContainer();

export function registerServices(): void {
}
