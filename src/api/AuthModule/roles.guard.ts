// auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<number[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    
    console.log('=== ROLES GUARD DEBUG ===');
    console.log('Required roles:', requiredRoles);
    
    if (!requiredRoles) {
      console.log('No roles required, allowing access');
      return true;
    }
    
    const { user } = context.switchToHttp().getRequest();
    console.log('User object:', user);
    console.log('User role:', user?.user?.role);
    
    if (!user || !user.user) {
      console.log('No user found in request');
      return false;
    }
    
    const userRole = user.user.role;
    const hasPermission = requiredRoles.some((role) => userRole <= role);
    
    console.log(`User role ${userRole} checking against required roles [${requiredRoles.join(', ')}]: ${hasPermission}`);
    console.log('========================');
    
    return hasPermission;
  }
}