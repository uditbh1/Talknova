import { mongoose } from "~/config/db.server";
//create model for {{pascalCase name}}
const modelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const {{pascalCase name}} = mongoose.models.{{pascalCase name}} || mongoose.model("{{pascalCase name}}", modelSchema);
