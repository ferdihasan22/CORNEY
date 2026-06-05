// Store mini untuk membuka/menutup modal pemilih printer (native).
let open = false
const subs = new Set()
function emit() { subs.forEach((f) => f()) }

export function openPrinterPicker() { open = true; emit() }
export function closePrinterPicker() { open = false; emit() }
export function subscribePicker(fn) { subs.add(fn); return () => subs.delete(fn) }
export function isPickerOpen() { return open }
