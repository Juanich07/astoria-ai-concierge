export const tourPackages = [
  {
    id: 'port-barton',
    name: 'Port Barton',
    duration: '7:30 AM - 5:00 PM',
    pricing: [
      { pax: '2pax (minimum)', price: 7800 },
      { pax: '3pax', price: 6390 },
      { pax: '4pax', price: 5280 },
      { pax: '5pax', price: 5190 },
      { pax: '6pax', price: 5090 },
      { pax: '7pax', price: 4980 },
      { pax: '8pax', price: 4740 },
      { pax: '9pax', price: 4740 },
      { pax: '10pax', price: 4740 }
    ],
    inclusions: ['Van transportation', 'Boat rides', 'Licensed tour guide', 'Environmental fee', 'Entrance fee', 'Picnic lunch', 'Shower room', 'Towels'],
    itinerary: ['Twin reef', 'Pena plata or giligans', 'Beach', 'Turtle spot', 'Fantastic reef', 'Exotic or maxima island', 'Starfish/sand bar']
  },
  {
    id: 'underground-river',
    name: 'Underground River',
    duration: '7:00 AM - 3:30 PM',
    pricing: [
      { pax: '2pax (minimum)', price: 6900 },
      { pax: '3pax', price: 5750 },
      { pax: '4pax', price: 5300 },
      { pax: '5pax', price: 4500 },
      { pax: '6pax', price: 4000 },
      { pax: '7pax', price: 3900 },
      { pax: '8pax', price: 3700 },
      { pax: '9pax', price: 2975 },
      { pax: '10pax', price: 2750 }
    ],
    inclusions: ['Van transportation', 'Boat rides', 'Licensed tour guide', 'Environmental fee', 'Entrance fee', 'Buffet lunch'],
    itinerary: ['View deck', 'Karst mountain', 'Sabang bay', 'Mini forest trail', 'Underground river']
  },
  {
    id: 'honda-bay',
    name: 'Honda Bay',
    duration: '7:30 AM - 5:00 PM',
    pricing: [
      { pax: '2pax (minimum)', price: 6480 },
      { pax: '3pax', price: 5390 },
      { pax: '4pax', price: 5280 },
      { pax: '5pax', price: 4800 },
      { pax: '6pax', price: 4320 },
      { pax: '7pax', price: 3410 },
      { pax: '8pax', price: 2575 },
      { pax: '9pax', price: 2750 },
      { pax: '10pax', price: 2400 }
    ],
    inclusions: ['Van transportation', 'Boat rides', 'Licensed tour guide', 'Environmental fee', 'Entrance fee', 'Picnic lunch', 'Shower room', 'Towels'],
    itinerary: ['Luli island', 'Cowrie', 'Pambato coral reef']
  },
  {
    id: 'city-tour',
    name: 'City Tour',
    duration: '8:00 AM - 2:00 PM / 1:00 PM - 7:00 PM',
    pricing: [
      { pax: '2pax (minimum)', price: 4600 },
      { pax: '3pax', price: 3420 },
      { pax: '4pax', price: 2860 },
      { pax: '5pax', price: 2640 },
      { pax: '6pax', price: 2310 },
      { pax: '7pax', price: 2090 },
      { pax: '8pax', price: 1870 },
      { pax: '9pax', price: 1650 },
      { pax: '10pax', price: 4550 }
    ],
    inclusions: ['Van transportation', 'Licensed tour guide', 'Environmental fee', 'Entrance fee', 'Light snack'],
    itinerary: ['Baywalk', 'Immaculate conception cathedral', 'Balay kubol', 'Plaza guatel', 'Crocodile farm', 'Butterfly garden', 'Mitras ranch', 'Bakers hill', 'Shopping center']
  },
  {
    id: 'el-nido',
    name: 'El Nido',
    duration: '5:00 AM - 9:30 PM',
    pricing: [
      { pax: '2pax (minimum)', price: 12700 },
      { pax: '3pax', price: 9200 },
      { pax: '4pax', price: 7840 },
      { pax: '5pax', price: 6160 },
      { pax: '6pax', price: 5480 },
      { pax: '7pax', price: 4650 },
      { pax: '8pax', price: 4650 },
      { pax: '9pax', price: 4650 },
      { pax: '10pax', price: 4400 }
    ],
    inclusions: ['Van transportation', 'Boat rides', 'Licensed tour guide', 'Environmental fee', 'Entrance fee', 'Picnic lunch', 'Shower room', 'Towels'],
    itinerary: ['Small or big lagoon', 'Payong payong', 'Secret lagoon', 'Shimizu island', 'Seven commando beach']
  },
  {
    id: 'sandbar',
    name: 'Sandbar',
    duration: '7:30 AM - 9:30 AM / 10:00 AM - 12:00 PM',
    pricing: [
      { pax: 'Per Person', price: 1200 }
    ],
    inclusions: ['Boat ride', 'Bottled water', 'Towels'],
    itinerary: ['Sandbar']
  }
];

export const sharedGroupTours = [
  {
    tour: 'Underground River',
    rate: 'Php 3,400/Pax'
  },
  {
    tour: 'Honda Bay',
    rate: 'Php 2,400/Pax'
  },
  {
    tour: 'City Tour',
    rate: 'Php 1,430/Pax'
  },
  {
    tour: 'El Nido',
    rate: 'Php 4,740/pax'
  }
];

export const tourContact = {
  phone: '(+63) 908-872-7931',
  email: 'tours@astoriapalawan.com',
  note: 'You can also dial "0" from your room to reach the Front Desk for tour bookings.'
};
