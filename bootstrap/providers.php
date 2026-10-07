<?php

use App\Providers\AnalyticsServiceProvider;
use App\Providers\AppServiceProvider;
use App\Providers\AttendanceServiceProvider;
use App\Providers\AutomationServiceProvider;
use App\Providers\FortifyServiceProvider;
use App\Providers\GoogleServiceProvider;
use App\Providers\HorizonServiceProvider;
use App\Providers\MeetingsServiceProvider;
use App\Providers\NotificationServiceProvider;
use App\Providers\PrivacyServiceProvider;
use App\Providers\RequestsServiceProvider;
use App\Providers\WorkspaceServiceProvider;

return [
    AppServiceProvider::class,
    AttendanceServiceProvider::class,
    FortifyServiceProvider::class,
    GoogleServiceProvider::class,
    HorizonServiceProvider::class,
    RequestsServiceProvider::class,
    WorkspaceServiceProvider::class,
    NotificationServiceProvider::class,
    AnalyticsServiceProvider::class,
    PrivacyServiceProvider::class,
    AutomationServiceProvider::class,
    MeetingsServiceProvider::class,
];
