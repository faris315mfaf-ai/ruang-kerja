<?php

use App\Providers\AppServiceProvider;
use App\Providers\FortifyServiceProvider;
use App\Providers\GoogleServiceProvider;
use App\Providers\HorizonServiceProvider;
use App\Providers\NotificationServiceProvider;

return [
    AppServiceProvider::class,
    FortifyServiceProvider::class,
    GoogleServiceProvider::class,
    HorizonServiceProvider::class,
    NotificationServiceProvider::class,
];
