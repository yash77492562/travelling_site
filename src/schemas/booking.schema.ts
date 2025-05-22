import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

// Participant sub-schema
@Schema({ _id: false })
class Participant {
    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    age: number;

    @Prop({ required: true, enum: ['Male', 'Female', 'Other'] })
    gender: string;

    @Prop()
    id_proof_type: string;

    @Prop()
    id_proof_number: string;
}

const ParticipantSchema = SchemaFactory.createForClass(Participant);

@Schema({
    timestamps: true
})
export class Booking {
    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
    user_id: mongoose.Types.ObjectId;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'TourPackage', required: true })
    tour_package_id: mongoose.Types.ObjectId;

    @Prop({ required: true, unique: true })
    booking_reference: string; // Auto-generated unique ID like "PH-2025-001"

    @Prop({ required: true })
    participant_count: number;

    @Prop({ required: true })
    total_amount: number;

    @Prop({ required: true, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' })
    booking_status: string;

    @Prop({ required: true, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' })
    payment_status: string;

    @Prop()
    payment_id: string; // Razorpay payment ID

    @Prop()
    razorpay_order_id: string;

    @Prop()
    razorpay_signature: string;

    @Prop({ type: Date, required: true })
    travel_date: Date;

    @Prop({ required: true })
    primary_contact_name: string;

    @Prop({ required: true })
    primary_contact_phone: string;

    @Prop({ required: true })
    primary_contact_email: string;

    @Prop({ type: [ParticipantSchema], default: [] })
    participants: Participant[];

    @Prop()
    special_requirements: string;

    @Prop()
    emergency_contact_name: string;

    @Prop()
    emergency_contact_phone: string;

    @Prop()
    pickup_location: string;

    @Prop()
    cancellation_reason: string;

    @Prop({ type: Date })
    cancelled_at: Date;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
    cancelled_by: mongoose.Types.ObjectId;

    @Prop({ type: Boolean, default: false })
    is_deleted: boolean;

    @Prop({ type: Date })
    is_deleted_date: Date;

    // Payment tracking
    @Prop()
    payment_method: string; // 'razorpay', 'bank_transfer', etc.

    @Prop({ type: Date })
    payment_date: Date;

    @Prop()
    refund_amount: number;

    @Prop({ type: Date })
    refund_date: Date;

    @Prop()
    refund_reference: string;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);