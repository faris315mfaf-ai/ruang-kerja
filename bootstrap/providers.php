<?php

use App\Providers\AppServiceProvider;
use App\Providers\FortifyServiceProvider;
use App\Providers\GoogleServiceProvider;
use App\Providers\HorizonServiceProvider;
use App\Providers\NotificationServiceProvider;
use App\Providers\RequestsServiceProvider;
use App\Providers\WorkspaceServiceProvider;

return [
    AppServiceProvider::class,
    FortifyServiceProvider::class,
    GoogleServiceProvider::class,
    HorizonServiceProvider::class,
    RequestsServiceProvider::class,
    WorkspaceServiceProvider::class,
    NotificationServiceProvider::class,
];
