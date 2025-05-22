export const CommonConfig = {
    // Server Configuration
    PORT: process.env.PORT || 3000,
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/traveldb?authSource=admin',
    API_URL: process.env.API_URL || 'api/',
    API_ADMIN_URL: process.env.API_ADMIN_URL || 'api/admin/',
    APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:3000/',
    APP_BASE_URL_PDF: process.env.APP_BASE_URL_PDF,
    // FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3001',

    // AWS Configuration
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION || 'ap-south-1',
    AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,

    // Security
    BCRYPTSALT: 10,
    JWT_SECRET: process.env.JWT_SECRET || '$#%^TYGHGY^%%^RTYG&^YHHY&*HYGT%^DREDESW#@$W#%DFTV^AS#%$$%',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    CRYPTO_SECRET_KEY: process.env.CRYPTO_SECRET_KEY || '$#%^TYGHGY^%%^RTYG&^YHHY&*HYGT%^DREDESW#@$W#%DFTV^AS#%$$%',

    // Razorpay Configuration
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,

    // Email Configuration
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: parseInt(process.env.SMTP_PORT ?? '') || 587,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@packershaven.com',
    FROM_NAME: process.env.FROM_NAME || 'Packers Haven',

    // Zoho Configuration
    ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID,
    ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET,
    ZOHO_REFRESH_TOKEN: process.env.ZOHO_REFRESH_TOKEN,
    ZOHO_ACCESS_TOKEN: process.env.ZOHO_ACCESS_TOKEN,

    // File Upload Configuration
    MAX_FILE_SIZE: process.env.MAX_FILE_SIZE || '10MB',
    ALLOWED_FILE_TYPES: process.env.ALLOWED_FILE_TYPES || 'jpg,jpeg,png,pdf,doc,docx',
    UPLOAD_PATH: process.env.UPLOAD_PATH || './uploads',

    // Application Settings
    DEFAULT_PAGE_SIZE: parseInt(process.env.DEFAULT_PAGE_SIZE ?? '') || 10,
    MAX_PAGE_SIZE: parseInt(process.env.MAX_PAGE_SIZE ?? '') || 100,
    
    // Business Logic
    BOOKING_CANCELLATION_HOURS: parseInt(process.env.BOOKING_CANCELLATION_HOURS ?? '') || 48,
    PAYMENT_TIMEOUT_MINUTES: parseInt(process.env.PAYMENT_TIMEOUT_MINUTES ?? '') || 15,
};