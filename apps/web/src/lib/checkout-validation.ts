import { formText } from './form-text';
export const governorates = [
  'Ariana',
  'Béja',
  'Ben Arous',
  'Bizerte',
  'Gabès',
  'Gafsa',
  'Jendouba',
  'Kairouan',
  'Kasserine',
  'Kébili',
  'Kef',
  'Mahdia',
  'Manouba',
  'Médenine',
  'Monastir',
  'Nabeul',
  'Sfax',
  'Sidi Bouzid',
  'Siliana',
  'Sousse',
  'Tataouine',
  'Tozeur',
  'Tunis',
  'Zaghouan'
];
export function validateCheckout(data: FormData): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of ['firstName', 'lastName'])
    if (formText(data.get(field)).trim().length < 2)
      errors[field] = 'Indiquez au moins 2 caractères.';
  if (!/^(?:(?:\+216|00216|216))?[0-9]{8}$/.test(formText(data.get('phone')).replace(/\s/g, '')))
    errors.phone = 'Indiquez un numéro de téléphone valide.';
  if (!governorates.includes(formText(data.get('governorate'))))
    errors.governorate = 'Choisissez votre gouvernorat.';
  if (formText(data.get('address')).trim().length < 5)
    errors.address = 'Précisez la rue, le numéro et la localité.';
  return errors;
}
