set nocount on;
go

if object_id(N'dbo.sanctionArchive', N'U') is null
begin
  create table dbo.[sanctionArchive] (
    [id] int not null,
    [uniqueid] nvarchar(15) not null,
    [dte] datetime null,
    [startTime] time(7) null,
    [clubcode] nvarchar(5) null,
    [tournname] nvarchar(100) not null,
    [taddr] nvarchar(80) null,
    [tournhost] nvarchar(75) null,
    [site] nvarchar(80) null,
    [number_of_teams] int null,
    [agedivision] nvarchar(50) null,
    [division] nvarchar(20) null,
    [entry_fee] money null,
    [paymentType] nvarchar(50) null,
    [check_payable_to] nvarchar(50) null,
    [CCPayment] char(1) null default ('N'),
    [paymentURL] nvarchar(100) null,
    [awards] nvarchar(3) null,
    [display_this_record] nvarchar(3) null,
    [pool_play] nvarchar(50) null,
    [otherformat] nvarchar(50) null,
    [playoff_format] nvarchar(50) null,
    [qtr_finals] nvarchar(15) null,
    [semi_finals] nvarchar(15) null,
    [finals] nvarchar(15) null,
    [locker_room] nvarchar(3) null,
    [showers] nvarchar(3) null,
    [food] nvarchar(10) null,
    [closing_dte] datetime null,
    [type] nvarchar(10) null,
    [status] nvarchar(10) null,
    [priority] nvarchar(2) null,
    [comments1] nvarchar(200) null,
    [comments2] nvarchar(200) null,
    [HDP] char(1) null,
    [season] char(4) null,
    [AES_closedDate] datetime null,
    [AES_scoresheets] datetime null,
    [AES_added] datetime null,
    [AES_okToPay] char(1) null
  );
  print 'created dbo.sanctionArchive';
end
else
  print 'exists dbo.sanctionArchive';
go
