import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

@Schema({
    timestamps: true
})
export class TourPackage {
    @Prop({ required: true, maxlength: 200 })
    title: string;

    @Prop({ required: true })
    description: string;

    @Prop({ required: true })
    short_description: string;

    @Prop({ required: true })
    price: number;

    @Prop()
    discounted_price: number;

    @Prop({ required: true })
    duration: string; // "3 Days 2 Nights"

    @Prop({ required: true })
    location: string;

    @Prop({ required: true, enum: ['tours', 'weekend-getaways', 'ladakh-specials'] })
    category: string;

    @Prop([String])
    images: string[];

    @Prop([String])
    highlights: string[];

    @Prop()
    itinerary: string; // JSON string or detailed text

    @Prop([String])
    included: string[];

    @Prop([String])
    excluded: string[];

    @Prop()
    terms_conditions: string;

    @Prop({ type: Date })
    available_from: Date;

    @Prop({ type: Date })
    available_to: Date;

    @Prop({ type: Boolean, default: true })
    is_active: boolean;

    @Prop({ type: Boolean, default: false })
    is_featured: boolean;

    @Prop({ default: 0 })
    max_participants: number;

    @Prop({ default: 0 })
    current_bookings: number;

    @Prop()
    meeting_point: string;

    @Prop()
    difficulty_level: string; // Easy, Moderate, Hard

    @Prop({ type: Boolean, default: false })
    is_deleted: boolean;

    @Prop({ type: Date })
    is_deleted_date: Date;

    // SEO Fields
    @Prop()
    meta_title: string;

    @Prop()
    meta_description: string;

    @Prop([String])
    meta_keywords: string[];

    // Slug for URL
    @Prop({ unique: true })
    slug: string;
}

export const TourPackageSchema = SchemaFactory.createForClass(TourPackage);