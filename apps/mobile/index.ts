// Task latar belakang harus terdaftar (defineTask) pada start JS apa pun, termasuk start headless
// oleh sistem tanpa komponen yang dirender — jadi diimpor di titik masuk, sebelum expo-router.
import './src/offline/latar';
// Widget layar utama (task handler pembaruan + layar setelan) juga harus terdaftar pada start headless.
import './src/widget/daftar';
import 'expo-router/entry';
