// Task latar belakang harus terdaftar (defineTask) pada start JS apa pun, termasuk start headless
// oleh sistem tanpa komponen yang dirender — jadi diimpor di titik masuk, sebelum expo-router.
import './src/offline/latar';
import 'expo-router/entry';
