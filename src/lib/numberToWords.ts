// Utility to convert numbers to words in Pakistani Rupees format (Lakh, Crore)

const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function convertGroup(n: number): string {
  let str = "";
  if (n > 99) {
    str += ones[Math.floor(n / 100)] + " Hundred ";
    n = n % 100;
  }
  if (n > 9 && n < 20) {
    str += teens[n - 10] + " ";
  } else {
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + " ";
      n = n % 10;
    }
    if (n > 0) {
      str += ones[n] + " ";
    }
  }
  return str.trim();
}

export function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  if (!num || isNaN(num)) return "";

  const intPart = Math.floor(Math.abs(num));
  const decimalPart = Math.round((Math.abs(num) - intPart) * 100);

  let str = "";
  let n = intPart;

  const crore = Math.floor(n / 10000000);
  n = n % 10000000;

  const lakh = Math.floor(n / 100000);
  n = n % 100000;

  const thousand = Math.floor(n / 1000);
  n = n % 1000;

  const remainder = n;

  if (crore > 0) {
    str += convertGroup(crore) + " Crore ";
  }
  if (lakh > 0) {
    str += convertGroup(lakh) + " Lac ";
  }
  if (thousand > 0) {
    str += convertGroup(thousand) + " Thousand ";
  }
  if (remainder > 0) {
    str += convertGroup(remainder) + " ";
  }

  let result = "Rupees " + (str.trim() || "Zero");
  if (decimalPart > 0) {
    result += " and " + convertGroup(decimalPart) + " Paisa";
  }
  return result + " Only";
}
