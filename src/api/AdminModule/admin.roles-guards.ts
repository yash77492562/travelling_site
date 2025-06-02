import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './admin.roles-decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<number[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    console.log('=== ROLES GUARD DEBUG ===');
    console.log('Required roles:', requiredRoles);

    if (!requiredRoles || requiredRoles.length === 0) {
      console.log('No roles required, allowing access');
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    console.log('Full user object from request:', JSON.stringify(user, null, 2));
    
    if (!user) {
      console.log('No user found in request');
      throw new ForbiddenException('User not authenticated');
    }

    // Handle the nested user structure from your JWT payload
    // Based on your debug output: user.user.role
    let userRole;
    
    if (user.user && typeof user.user.role !== 'undefined') {
      userRole = user.user.role;
      console.log('Found nested user role:', userRole);
    } else if (typeof user.role !== 'undefined') {
      userRole = user.role;
      console.log('Found direct user role:', userRole);
    } else {
      console.log('No role found in user object');
      throw new ForbiddenException('User role not found');
    }

    console.log(`Checking user role ${userRole} against required roles [${requiredRoles.join(', ')}]`);

    // Check if user role is in the allowed roles
    const hasRole = requiredRoles.some((role) => userRole === role);
    
    console.log(`Role check result: ${hasRole}`);
    console.log('========================');
    
    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions to access this resource');
    }

    return true;
  }
}