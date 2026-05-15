set nocount on;
go

if object_id(N'dbo.coordcontacts', N'U') is null
begin
  create table dbo.[coordcontacts] (
    [category] nvarchar(40) not null,
    [level] nvarchar(20) null,
    [grouping] nvarchar(40) null,
    [coordlname] nvarchar(20) null,
    [coordfname] nvarchar(20) null,
    [straddress1] nvarchar(50) null,
    [straddress2] nvarchar(50) null,
    [city] nvarchar(30) null,
    [st] nvarchar(2) null,
    [zip] nvarchar(5) null,
    [phone1] nvarchar(14) null,
    [phone2] nvarchar(14) null,
    [ext] nvarchar(7) null,
    [fax] nvarchar(14) null,
    [email] nvarchar(80) null,
    [display_record] nvarchar(3) null,
    [type] nvarchar(50) null,
    constraint [PK_coordcontacts] primary key ([category])
  );
  print 'created dbo.coordcontacts';
end
else
  print 'exists dbo.coordcontacts';
go
