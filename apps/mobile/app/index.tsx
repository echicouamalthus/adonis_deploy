import { View, Text } from "react-native";
import { Button, FormField, TextField } from "heroui-native";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

const formSchema = z.object({
  title: z
    .string()
    .min(1, "Le titre doit contenir au moins 1 caractère.")
    .max(5, "Le titre doit contenir au plus 5 caractères."),
  description: z
    .string()
    .min(20, "La description doit contenir au moins 20 caractères.")
    .max(100, "La description doit contenir au plus 100 caractères."),
  notification: z.boolean(),
});

// Helper pour valider un champ
const validateField = (
  fieldName: keyof typeof formSchema.shape,
  value: unknown,
) => {
  const result = formSchema.shape[fieldName].safeParse(value);
  return result.success ? undefined : result.error.issues[0].message;
};

export default function Index() {
  const form = useForm({
    defaultValues: {
      title: "",
      description: "",
      notification: false,
    },
    onSubmit: async ({ value }) => {
      // Validation manuelle avant submit
      const result = formSchema.safeParse(value);
      if (!result.success) {
        console.log("Validation errors:", result.error.issues);
        return;
      }
      console.log("Form submitted:", result.data);
    },
  });

  return (
    <KeyboardAwareScrollView
      className="flex-1"
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
    >
      <View className="p-4 gap-6">
        <form.Field
          name="title"
          validators={{
            onBlur: ({ value }) => validateField("title", value),
            onChange: ({ value }) => validateField("title", value),
          }}
        >
          {(field) => (
            <TextField
              isInvalid={
                field.state.meta.isTouched && !!field.state.meta.errors.length
              }
            >
              <TextField.Label>Title</TextField.Label>

              <TextField.Input
                className="w-full"
                placeholder="Enter your text"
                value={field.state.value}
                onChangeText={field.handleChange}
                onBlur={field.handleBlur}
              />

              {/* Affiche le message d'erreur */}
              {field.state.meta.isTouched &&
                field.state.meta.errors.length > 0 && (
                  <TextField.ErrorMessage>
                    {field.state.meta.errors.join(", ")}
                  </TextField.ErrorMessage>
                )}
            </TextField>
          )}
        </form.Field>

        <form.Field
          name="description"
          validators={{
            onBlur: ({ value }) => validateField("description", value),
            onChange: ({ value }) => validateField("description", value),
          }}
        >
          {(field) => (
            <TextField
              isInvalid={
                field.state.meta.isTouched && !!field.state.meta.errors.length
              }
              className="relative"
            >
              <TextField.Label>Description</TextField.Label>

              <TextField.Input
                className="w-full"
                placeholder="Entrez une description..."
                value={field.state.value}
                onChangeText={field.handleChange}
                onBlur={field.handleBlur}
                multiline
                numberOfLines={10}
                textAlignVertical="top"
                style={{ minHeight: 200 }}
              />
              <Text
                className={`absolute bottom-4 right-3 text-sm ${field.state.value.length > 100 ? "text-red-500" : "text-gray-500"}`}
              >
                {field.state.value.length}/100
              </Text>

              <View className="flex-row justify-between mt-1">
                <View>
                  {field.state.meta.isTouched &&
                    field.state.meta.errors.length > 0 && (
                      <TextField.ErrorMessage>
                        {field.state.meta.errors.join(", ")}
                      </TextField.ErrorMessage>
                    )}
                </View>
              </View>
            </TextField>
          )}
        </form.Field>

        <form.Field name="notification">
          {(field) => (
            <FormField
              isSelected={field.state.value}
              onSelectedChange={field.handleChange}
              onBlur={() => field.validate("blur")}
              className="flex-row justify-between"
            >
              <View className="flex-col">
                <FormField.Label>Notification</FormField.Label>
                <FormField.Description>
                  Receive notifications
                </FormField.Description>
              </View>
              <FormField.Indicator />
            </FormField>
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              onPress={form.handleSubmit}
              isDisabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "Envoi..." : "Submit"}
            </Button>
          )}
        </form.Subscribe>
      </View>
    </KeyboardAwareScrollView>
  );
}
