import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Roles decorator to specify which user roles can access a route
 * @param roles - Array of role numbers (0: Super Admin, 1: Admin, 2: User, 3: Guest)
 * 
 * Usage examples:
 * @Roles(0) - Only Super Admin
 * @Roles(0, 1) - Super Admin and Admin
 * @Roles(1, 2) - Admin and User
 */
export const Roles = (...roles: number[]) => SetMetadata(ROLES_KEY, roles);