export function generateSixDigitOtp() {
// Returns a zero-padded 6-digit string, e.g. "034912"
const n = Math.floor(Math.random() * 1000000);
return String(n).padStart(6, '0');
}