import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
    timestamps: true
})
export class SiteSettings {
    @Prop({ required: true, unique: true })
    key: string; // "site_title", "contact_email", "razorpay_key", etc.

    @Prop({ required: true })
    value: string;

    @Prop()
    label: string; // Human readable label for admin panel

    @Prop()
    description: string;

    @Prop({ default: 'string', enum: ['string', 'number', 'boolean', 'json', 'file', 'email', 'url'] })
    type: string;

    @Prop({ type: Boolean, default: false })
    is_sensitive: boolean; // For API keys, passwords - won't be returned in API

    @Prop({ type: Boolean, default: true })
    is_editable: boolean; // Some settings might be read-only

    @Prop()
    category: string; // Group settings: 'general', 'payment', 'email', 'seo', etc.

    @Prop()
    validation_rules: string; // JSON string with validation rules

    @Prop({ type: Boolean, default: false })
    requires_restart: boolean; // If changing this setting requires app restart

    @Prop({ type: Boolean, default: false })
    is_deleted: boolean;
}

export const SiteSettingsSchema = SchemaFactory.createForClass(SiteSettings);