Prerequisites
Make sure you have Node.js (version 16 or higher) and npm installed.
1. Install NestJS CLI
bashnpm install -g @nestjs/cli
2. Create a new project
bashnest new my-backend-project
cd my-backend-project
The CLI will ask you to choose a package manager (npm, yarn, or pnpm). Choose your preference.
3. Project structure
After creation, you'll have this structure:
src/
├── app.controller.spec.ts
├── app.controller.ts
├── app.module.ts
├── app.service.ts
└── main.ts
4. Start the development server
bashnpm run start:dev
Your server will run on http://localhost:3000 by default.
5. Basic setup enhancements
Environment configuration
Install configuration package:
bashnpm install @nestjs/config
Create a .env file in the root:
PORT=3000
DATABASE_URL=your_database_url
Update app.module.ts:
typescriptimport { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  // ...
})
export class AppModule {}
Add validation
bashnpm install class-validator class-transformer
Update main.ts:
typescriptimport { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(3000);
}
Database setup (optional)
For PostgreSQL with TypeORM:
bashnpm install @nestjs/typeorm typeorm pg @types/pg
For MongoDB with Mongoose:
bashnpm install @nestjs/mongoose mongoose
6. Generate resources
Use the CLI to generate modules, controllers, and services:
bashnest generate module users
nest generate controller users
nest generate service users
Or generate everything at once:
bashnest generate resource users
7. Common scripts

npm run start:dev - Development with hot reload
npm run start:prod - Production mode
npm run test - Run tests
npm run build - Build for production
