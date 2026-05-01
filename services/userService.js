// Base utilisateurs (simulation base de données)

export const users = [
  {
    id: 1,
    email: "admin@test.com",
    password: "admin123",
    role: "admin",
    plan: "pro"
  },
  {
    id: 2,
    email: "user@test.com",
    password: "user123",
    role: "user",
    plan: "free"
  }
];

export function findUser(email, password) {
  return users.find(
    (u) => u.email === email && u.password === password
  );
}
