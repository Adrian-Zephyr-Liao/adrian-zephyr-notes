import type { AuthUserResponse } from "../public/auth.js";

type AdminUserResponse = AuthUserResponse & {
  role: "ADMIN";
};

type AdminMeResponse = {
  user: AdminUserResponse | null;
};

export type { AdminMeResponse, AdminUserResponse };
