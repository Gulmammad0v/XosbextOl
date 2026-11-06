type SelectedLocation = { latitude: number; longitude: number; address?: string };

let selected: SelectedLocation | undefined;

export function saveSelectedLocation(value: SelectedLocation) {
  selected = value;
}

export function takeSelectedLocation() {
  const value = selected;
  selected = undefined;
  return value;
}
