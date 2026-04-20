export interface TestUser {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
}

export const ALICE: TestUser = {
  email: "alice@test.travel-manager.local",
  password: "Alice_Pwd_2026!",
  displayName: "앨리스",
};

export const BOB: TestUser = {
  email: "bob@test.travel-manager.local",
  password: "Bob_Pwd_2026!",
  displayName: "밥",
};
