import { PlanModel } from '../plan';

export async function seedDefaultPlans() {
  try {
    // Check if default plans exist
    const existingPlans = await PlanModel.find({ isDefault: true });
    if (existingPlans.length > 0) {
      console.log('Default plans already exist');
      return;
    }

    // Create default plans
    const defaultPlans = [
      {
        name: 'FREE',
        price: 0,
        yearlyPrice: 0,
        isMonthly: false,
        maxDocuments: 5,
        maxFileSize: 2,
        maxUrls: 2,
        isDefault: true,
        isActive: true,
        isDeleted: false,
        defaultPlanType: 'FREE',
        allowedAgents: 1,
        billingCycle: 'MONTHLY'
      },
      {
        name: 'STARTER',
        price: 5,
        yearlyPrice: 50,
        isMonthly: true,
        maxDocuments: 10,
        maxFileSize: 5,
        maxUrls: 30,
        isDefault: true,
        isActive: true,
        isDeleted: false,
        defaultPlanType: 'STARTER',
        allowedAgents: 1,
        billingCycle: 'MONTHLY'
      },
      {
        name: 'BUSINESS',
        price: 10,
        yearlyPrice: 100,
        isMonthly: true,
        maxDocuments: 20,
        maxFileSize: 10,
        maxUrls: 100,
        isDefault: true,
        isActive: true,
        isDeleted: false,
        defaultPlanType: 'BUSINESS',
        allowedAgents: 1,
        billingCycle: 'MONTHLY'
      }
    ];

    await PlanModel.insertMany(defaultPlans);
    console.log('Default plans created successfully');
  } catch (error) {
    console.error('Error seeding default plans:', error);
  }
} 