// auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    console.log('=== JWT AUTH GUARD DEBUG ===');
    
    const request = context.switchToHttp().getRequest();
    console.log('Authorization header:', request.headers.authorization);
    console.log('All headers:', JSON.stringify(request.headers, null, 2));
    
    console.log('Context:', context);
    
    const result = super.canActivate(context);
    console.log('Super.canActivate result:', result);
    
    console.log('============================');
    
    return result;
  }

  handleRequest(err: any, user: any, info: any, context: any) {
    console.log('=== HANDLE REQUEST DEBUG ===');
    console.log('Error:', err);
    console.log('User:', user);
    console.log('Info:', info);
    console.log('Context:', context);
    console.log('============================');
    
    if (err || !user) {
      console.log('Throwing UnauthorizedException - err:', err, 'user:', user);
      throw err || new UnauthorizedException('Access token required');
    }
    return user;
  }
}