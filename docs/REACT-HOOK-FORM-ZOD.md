# React Hook Form + Zod vs TanStack Form + Zod

Ce guide compare les deux approches de gestion de formulaires dans React Native et montre comment les utiliser avec HeroUI Native.

## Comparaison des approches

| Aspect | @tanstack/react-form | react-hook-form |
|--------|---------------------|-----------------|
| **Validation Zod** | Manuelle avec `safeParse()` | Automatique avec `zodResolver` |
| **Syntaxe** | `form.Field` + render props | `Controller` + render props |
| **État des erreurs** | `field.state.meta.errors` | `formState.errors` |
| **Taille bundle** | Plus léger | Plus populaire |
| **Typage TypeScript** | Excellent | Excellent |

---

## Approche 1 : React Hook Form + Zod (Recommandée)

### Installation

```bash
pnpm --filter mobile add react-hook-form @hookform/resolvers zod
```

### Exemple avec HeroUI Native

```tsx
import { View, Text } from 'react-native';
import { Button, FormField, TextField } from 'heroui-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

// 1. Définir le schema Zod
const formSchema = z.object({
  title: z
    .string()
    .min(1, 'Le titre doit contenir au moins 1 caractère.')
    .max(5, 'Le titre doit contenir au plus 5 caractères.'),
  description: z
    .string()
    .min(20, 'La description doit contenir au moins 20 caractères.')
    .max(100, 'La description doit contenir au plus 100 caractères.'),
  notification: z.boolean(),
});

// 2. Inférer le type TypeScript depuis le schema
type FormData = z.infer<typeof formSchema>;

export default function Index() {
  // 3. Initialiser le formulaire avec zodResolver
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      notification: false,
    },
    mode: 'onBlur', // Validation sur blur (peut être 'onChange', 'onSubmit', 'all')
  });

  // 4. Observer la valeur pour le compteur
  const descriptionValue = watch('description');

  // 5. Fonction de soumission
  const onSubmit = async (data: FormData) => {
    console.log('Form submitted:', data);
    // Appel API ici...
  };

  return (
    <KeyboardAwareScrollView
      className="flex-1"
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
    >
      <View className="p-4 gap-6">
        {/* Champ Title */}
        <Controller
          control={control}
          name="title"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField isInvalid={!!errors.title}>
              <TextField.Label>Title</TextField.Label>
              <TextField.Input
                className="w-full"
                placeholder="Enter your text"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
              {errors.title && (
                <TextField.ErrorMessage>
                  {errors.title.message}
                </TextField.ErrorMessage>
              )}
            </TextField>
          )}
        />

        {/* Champ Description (TextArea) */}
        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField isInvalid={!!errors.description} className="relative">
              <TextField.Label>Description</TextField.Label>
              <TextField.Input
                className="w-full"
                placeholder="Entrez une description..."
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                multiline
                numberOfLines={10}
                textAlignVertical="top"
                style={{ minHeight: 200 }}
              />
              <Text
                className={`absolute bottom-4 right-3 text-sm ${
                  (descriptionValue?.length || 0) > 100
                    ? 'text-red-500'
                    : 'text-gray-500'
                }`}
              >
                {descriptionValue?.length || 0}/100
              </Text>
              {errors.description && (
                <TextField.ErrorMessage>
                  {errors.description.message}
                </TextField.ErrorMessage>
              )}
            </TextField>
          )}
        />

        {/* Champ Notification (Switch) */}
        <Controller
          control={control}
          name="notification"
          render={({ field: { onChange, value } }) => (
            <FormField
              isSelected={value}
              onSelectedChange={onChange}
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
        />

        {/* Bouton Submit */}
        <Button
          onPress={handleSubmit(onSubmit)}
          isDisabled={!isValid || isSubmitting}
        >
          {isSubmitting ? 'Envoi...' : 'Submit'}
        </Button>
      </View>
    </KeyboardAwareScrollView>
  );
}
```

---

## Approche 2 : TanStack Form + Zod (Actuelle)

Cette approche nécessite une validation manuelle avec `safeParse()`.

```tsx
import { View, Text } from 'react-native';
import { Button, FormField, TextField } from 'heroui-native';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

const formSchema = z.object({
  title: z
    .string()
    .min(1, 'Le titre doit contenir au moins 1 caractère.')
    .max(5, 'Le titre doit contenir au plus 5 caractères.'),
  description: z
    .string()
    .min(20, 'La description doit contenir au moins 20 caractères.')
    .max(100, 'La description doit contenir au plus 100 caractères.'),
  notification: z.boolean(),
});

// Helper pour valider un champ individuellement
const validateField = (
  fieldName: keyof typeof formSchema.shape,
  value: unknown
) => {
  const result = formSchema.shape[fieldName].safeParse(value);
  return result.success ? undefined : result.error.issues[0].message;
};

export default function Index() {
  const form = useForm({
    defaultValues: {
      title: '',
      description: '',
      notification: false,
    },
    onSubmit: async ({ value }) => {
      const result = formSchema.safeParse(value);
      if (!result.success) {
        console.log('Validation errors:', result.error.issues);
        return;
      }
      console.log('Form submitted:', result.data);
    },
  });

  return (
    <KeyboardAwareScrollView className="flex-1" bottomOffset={20}>
      <View className="p-4 gap-6">
        <form.Field
          name="title"
          validators={{
            onBlur: ({ value }) => validateField('title', value),
            onChange: ({ value }) => validateField('title', value),
          }}
        >
          {field => (
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
              {field.state.meta.isTouched &&
                field.state.meta.errors.length > 0 && (
                  <TextField.ErrorMessage>
                    {field.state.meta.errors.join(', ')}
                  </TextField.ErrorMessage>
                )}
            </TextField>
          )}
        </form.Field>

        {/* ... autres champs similaires */}

        <form.Subscribe
          selector={state => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              onPress={form.handleSubmit}
              isDisabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? 'Envoi...' : 'Submit'}
            </Button>
          )}
        </form.Subscribe>
      </View>
    </KeyboardAwareScrollView>
  );
}
```

---

## Différences clés

### 1. Configuration du resolver

**React Hook Form** :
```tsx
const { control } = useForm({
  resolver: zodResolver(formSchema), // Validation automatique
  mode: 'onBlur',
});
```

**TanStack Form** :
```tsx
const form = useForm({
  defaultValues: {...},
  onSubmit: async ({ value }) => {
    const result = formSchema.safeParse(value); // Validation manuelle
  },
});
```

### 2. Déclaration des champs

**React Hook Form** :
```tsx
<Controller
  control={control}
  name="title"
  render={({ field: { onChange, onBlur, value } }) => (
    <TextInput value={value} onChangeText={onChange} onBlur={onBlur} />
  )}
/>
{errors.title && <Text>{errors.title.message}</Text>}
```

**TanStack Form** :
```tsx
<form.Field
  name="title"
  validators={{
    onBlur: ({ value }) => validateField('title', value),
    onChange: ({ value }) => validateField('title', value),
  }}
>
  {field => (
    <>
      <TextInput
        value={field.state.value}
        onChangeText={field.handleChange}
        onBlur={field.handleBlur}
      />
      {field.state.meta.errors.length > 0 && (
        <Text>{field.state.meta.errors.join(', ')}</Text>
      )}
    </>
  )}
</form.Field>
```

### 3. État du formulaire

**React Hook Form** :
```tsx
const { formState: { errors, isSubmitting, isValid } } = useForm();

<Button isDisabled={!isValid || isSubmitting} />
```

**TanStack Form** :
```tsx
<form.Subscribe selector={state => [state.canSubmit, state.isSubmitting]}>
  {([canSubmit, isSubmitting]) => (
    <Button isDisabled={!canSubmit || isSubmitting} />
  )}
</form.Subscribe>
```

---

## Modes de validation (React Hook Form)

```tsx
useForm({
  mode: 'onBlur',      // Valide quand le champ perd le focus (défaut)
  mode: 'onChange',    // Valide à chaque changement
  mode: 'onSubmit',    // Valide seulement au submit
  mode: 'onTouched',   // Valide au premier blur, puis onChange
  mode: 'all',         // Valide onBlur + onChange
});
```

---

## Bonnes pratiques

1. **Utiliser `z.infer<typeof schema>`** pour typer automatiquement les données
2. **Préférer `mode: 'onBlur'`** pour éviter les validations excessives
3. **Utiliser `watch()`** pour observer des valeurs (ex: compteur de caractères)
4. **Désactiver le bouton** avec `isValid` et `isSubmitting`
5. **Utiliser `KeyboardAwareScrollView`** pour gérer le clavier

---

## Migration de TanStack Form vers React Hook Form

1. Installer les dépendances :
   ```bash
   pnpm --filter mobile add react-hook-form @hookform/resolvers
   pnpm --filter mobile remove @tanstack/react-form @tanstack/zod-form-adapter
   ```

2. Remplacer les imports :
   ```tsx
   // Avant
   import { useForm } from '@tanstack/react-form';

   // Après
   import { useForm, Controller } from 'react-hook-form';
   import { zodResolver } from '@hookform/resolvers/zod';
   ```

3. Adapter la configuration du formulaire (voir exemples ci-dessus)

4. Remplacer `form.Field` par `Controller`

5. Utiliser `errors.fieldName` au lieu de `field.state.meta.errors`