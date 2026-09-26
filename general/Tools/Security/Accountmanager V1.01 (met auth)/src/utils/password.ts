
export const calculatePasswordStrength = (password: string): number => {
  let strength = 0;
  if (password.length > 8) strength += 1;
  if (password.length > 12) strength += 1;
  if (/[A-Z]/.test(password)) strength += 1;
  if (/[a-z]/.test(password)) strength += 1;
  if (/[0-9]/.test(password)) strength += 1;
  if (/[^A-Za-z0-9]/.test(password)) strength += 1;
  
  // Normalize to 0-4
  if (strength <= 2) return 0; // Very Weak
  if (strength === 3) return 1; // Weak
  if (strength === 4) return 2; // Medium
  if (strength === 5) return 3; // Strong
  return 4; // Very Strong
};

export const generatePassword = (length: number = 16): string => {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
  let retVal = "";
  const cryptoObj = window.crypto || (window as any).msCrypto;
  const values = new Uint32Array(length);
  cryptoObj.getRandomValues(values);
  for (let i = 0; i < length; i++) {
    retVal += charset.charAt(values[i] % charset.length);
  }
  return retVal;
};
