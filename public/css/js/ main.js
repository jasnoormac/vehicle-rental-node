document.addEventListener('DOMContentLoaded', () => {
  // Cars: keep daily price in hidden input
  const carRadios = document.querySelectorAll('input[name="car_id"]');
  const carPriceInput = document.getElementById('car_daily_price');
  if (carRadios && carPriceInput) {
    carRadios.forEach((r) => {
      r.addEventListener('change', () => {
        carPriceInput.value = r.dataset.price;
      });
      if (r.checked) {
        carPriceInput.value = r.dataset.price;
      }
    });
  }

  // Insurance: keep per-day price
  const insuranceRadios = document.querySelectorAll('input[name="insurance_id"]');
  const insurancePriceInput = document.getElementById('insurance_price');
  if (insuranceRadios && insurancePriceInput) {
    insuranceRadios.forEach((r) => {
      r.addEventListener('change', () => {
        const price = r.dataset.price || 0;
        insurancePriceInput.value = price;
      });
      if (r.checked) {
        insurancePriceInput.value = r.dataset.price || 0;
      }
    });
  }
});
