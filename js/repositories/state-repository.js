export class StateRepository {
  async load() {
    throw new Error("StateRepository.load() must be implemented");
  }

  async save(_state) {
    throw new Error("StateRepository.save() must be implemented");
  }

  async reset() {
    throw new Error("StateRepository.reset() must be implemented");
  }
}
