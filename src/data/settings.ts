export type HotelSettings = {
  checkIn: string;
  checkOut: string;
  frontDeskLocations: string[];
  restaurantName: string;
  restaurantHours: string;
  inRoomDiningHours: string;
  gymHours: string;
  poolHours: string;
  housekeepingHours: string;
  recreationHours: string;
  emergencyNumber: string;
  wifiDeviceLimit: number;
  wifiPolicy: string;
};

export const defaultSettings: HotelSettings = {
  checkIn: '2:00 PM',
  checkOut: '12:00 PM',
  frontDeskLocations: ['The Nest', 'The Canopy'],
  restaurantName: 'The Reserve',
  restaurantHours: '6:30 AM - 10:00 PM',
  inRoomDiningHours: '6:00 AM - 11:30 PM',
  gymHours: '6:00 AM - 10:00 PM',
  poolHours: '6:00 AM - 10:00 PM',
  housekeepingHours: '9:00 AM - 5:00 PM',
  recreationHours: '8:00 AM - 11:00 PM',
  emergencyNumber: '0',
  wifiDeviceLimit: 4,
  wifiPolicy: 'Free WiFi for 4 devices per room',
};
