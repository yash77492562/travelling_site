import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TourPackagesController } from './tour-packages.controller';
import { TourPackagesService } from './tour-packages.service';
import { TourPackage, TourPackageSchema } from '../../schemas/tour-package.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TourPackage.name, schema: TourPackageSchema }
    ])
  ],
  controllers: [TourPackagesController],
  providers: [TourPackagesService],
  exports: [TourPackagesService, MongooseModule]
})
export class TourPackagesModule {}