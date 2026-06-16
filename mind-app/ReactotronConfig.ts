import Reactotron from 'reactotron-react-native';

// Tylko w trybie deweloperskim
if (__DEV__) {
  Reactotron.configure({
    name: 'Mind App',
    host: 'localhost', // Na symulatorze. Na fizycznym iPhone zmień na IP Maca
  })
    .useReactNative()
    .connect();
}
