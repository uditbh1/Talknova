import { mongoose } from '~/config/db.server';
var Schema = mongoose.Schema;

var settingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true }, // e.g., DATA_FORMAT, AI_MODEL
    value: { type: Schema.Types.Mixed, required: true }, // Could be String, Number, Boolean, or an Object
    description: { type: String, default: '' }, // Optional description of the setting
    defaultValue: { type: Schema.Types.Mixed, default: null }, // Store default value
  },
  { timestamps: true }
);

// Static function to fetch all settings
settingsSchema.statics.getAllSettings = async function () {
  try {
    const settings = await this.find().lean(); // Fetch all settings
    return settings;
  } catch (error) {
    console.error('Error fetching settings:', error);
    return [];
  }
};

// Static function to get setting by key, returning the default if not set
settingsSchema.statics.getAllSettings = async function () {
  try {
    const settingsArray = await this.find().lean(); // Fetch all settings
    const settingsObject = {};

    settingsArray.forEach(setting => {
      // Use the value if set, otherwise use the defaultValue
      settingsObject[setting.key] = setting.value !== undefined ? setting.value : setting.defaultValue;
    });

    return settingsObject;
  } catch (error) {
    console.error('Error fetching settings:', error);
    return {};
  }
};

export const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
