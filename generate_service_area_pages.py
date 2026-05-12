#!/usr/bin/env python3
import os, json

os.makedirs('service-areas', exist_ok=True)

# ── Data ──────────────────────────────────────────────────────────────────────
LOCATIONS = [
  {'state':'Alabama','slug':'alabama','abbr':'AL','counties':[
    {'name':'Jefferson County','slug':'jefferson','cities':['Birmingham','Hoover','Bessemer','Vestavia Hills','Mountain Brook','Homewood','Trussville','Center Point']},
    {'name':'Madison County','slug':'madison','cities':['Huntsville','Madison','Harvest','Hazel Green','Meridianville','New Hope']},
    {'name':'Mobile County','slug':'mobile','cities':['Mobile','Saraland','Prichard','Chickasaw','Satsuma','Tillmans Corner']},
    {'name':'Montgomery County','slug':'montgomery','cities':['Montgomery','Pike Road','Prattville','Millbrook','Wetumpka']},
    {'name':'Shelby County','slug':'shelby','cities':['Alabaster','Pelham','Helena','Chelsea','Calera','Columbiana']},
    {'name':'Tuscaloosa County','slug':'tuscaloosa','cities':['Tuscaloosa','Northport','Cottondale','Vance','Moundville']},
    {'name':'Lee County','slug':'lee','cities':['Auburn','Opelika','Phenix City','Smiths Station','Valley']},
    {'name':'Baldwin County','slug':'baldwin','cities':['Daphne','Fairhope','Spanish Fort','Gulf Shores','Orange Beach','Foley']},
  ]},
  {'state':'Alaska','slug':'alaska','abbr':'AK','counties':[
    {'name':'Anchorage Borough','slug':'anchorage','cities':['Anchorage','Eagle River','Chugiak','Girdwood','Peters Creek']},
    {'name':'Matanuska-Susitna Borough','slug':'matanuska-susitna','cities':['Wasilla','Palmer','Houston','Big Lake','Willow']},
    {'name':'Fairbanks North Star Borough','slug':'fairbanks','cities':['Fairbanks','North Pole','Ester','Salcha','Two Rivers']},
    {'name':'Kenai Peninsula Borough','slug':'kenai-peninsula','cities':['Kenai','Soldotna','Homer','Seward','Anchor Point']},
    {'name':'Juneau Borough','slug':'juneau','cities':['Juneau','Douglas','Auke Bay','Mendenhall Valley']},
    {'name':'Sitka Borough','slug':'sitka','cities':['Sitka','Old Sitka','Sawmill Creek']},
  ]},
  {'state':'Arizona','slug':'arizona','abbr':'AZ','counties':[
    {'name':'Maricopa County','slug':'maricopa','cities':['Phoenix','Scottsdale','Mesa','Chandler','Gilbert','Tempe','Glendale','Peoria','Surprise','Avondale','Goodyear','Buckeye']},
    {'name':'Pima County','slug':'pima','cities':['Tucson','Marana','Oro Valley','Sahuarita','South Tucson','Ajo']},
    {'name':'Pinal County','slug':'pinal','cities':['Casa Grande','Apache Junction','Maricopa','Florence','Coolidge','Eloy']},
    {'name':'Yavapai County','slug':'yavapai','cities':['Prescott','Prescott Valley','Cottonwood','Sedona','Camp Verde','Chino Valley']},
    {'name':'Mohave County','slug':'mohave','cities':['Kingman','Bullhead City','Lake Havasu City','Fort Mohave','Golden Valley']},
    {'name':'Coconino County','slug':'coconino','cities':['Flagstaff','Sedona','Williams','Page','Tusayan']},
    {'name':'Yuma County','slug':'yuma','cities':['Yuma','Somerton','San Luis','Wellton','Dateland']},
  ]},
  {'state':'Arkansas','slug':'arkansas','abbr':'AR','counties':[
    {'name':'Pulaski County','slug':'pulaski','cities':['Little Rock','North Little Rock','Jacksonville','Sherwood','Maumelle','Cabot']},
    {'name':'Benton County','slug':'benton','cities':['Bentonville','Rogers','Springdale','Siloam Springs','Bella Vista','Cave Springs']},
    {'name':'Washington County','slug':'washington','cities':['Fayetteville','Springdale','Prairie Grove','Farmington','Greenland']},
    {'name':'Sebastian County','slug':'sebastian','cities':['Fort Smith','Greenwood','Barling','Van Buren','Lavaca']},
    {'name':'Saline County','slug':'saline','cities':['Benton','Bryant','Maumelle','Shannon Hills','Alexander']},
    {'name':'Craighead County','slug':'craighead','cities':['Jonesboro','Lake City','Brookland','Bono','Bay']},
  ]},
  {'state':'California','slug':'california','abbr':'CA','counties':[
    {'name':'Los Angeles County','slug':'los-angeles','cities':['Los Angeles','Long Beach','Glendale','Santa Clarita','Lancaster','Palmdale','Torrance','Pasadena','Pomona','Burbank']},
    {'name':'San Diego County','slug':'san-diego','cities':['San Diego','Chula Vista','Escondido','Oceanside','El Cajon','Carlsbad','Vista','San Marcos','Santee']},
    {'name':'Orange County','slug':'orange','cities':['Anaheim','Santa Ana','Irvine','Huntington Beach','Garden Grove','Costa Mesa','Fullerton','Orange','Mission Viejo']},
    {'name':'Santa Clara County','slug':'santa-clara','cities':['San Jose','Sunnyvale','Santa Clara','Mountain View','Palo Alto','Cupertino','Milpitas','Campbell']},
    {'name':'Alameda County','slug':'alameda','cities':['Oakland','Berkeley','Fremont','Hayward','San Leandro','Castro Valley','Newark','Union City']},
    {'name':'Riverside County','slug':'riverside','cities':['Riverside','Moreno Valley','Corona','Temecula','Murrieta','Menifee','Hemet','Indio']},
    {'name':'Sacramento County','slug':'sacramento','cities':['Sacramento','Elk Grove','Roseville','Folsom','Citrus Heights','Rancho Cordova','Antelope']},
    {'name':'San Bernardino County','slug':'san-bernardino','cities':['San Bernardino','Fontana','Ontario','Rancho Cucamonga','Victorville','Rialto','Hesperia']},
  ]},
  {'state':'Colorado','slug':'colorado','abbr':'CO','counties':[
    {'name':'Denver County','slug':'denver','cities':['Denver','Aurora','Lakewood','Westminster','Arvada','Thornton','Centennial','Englewood']},
    {'name':'El Paso County','slug':'el-paso','cities':['Colorado Springs','Fountain','Manitou Springs','Black Forest','Falcon','Cimarron Hills']},
    {'name':'Arapahoe County','slug':'arapahoe','cities':['Aurora','Centennial','Englewood','Littleton','Greenwood Village','Cherry Hills Village']},
    {'name':'Jefferson County','slug':'jefferson','cities':['Lakewood','Arvada','Wheat Ridge','Golden','Evergreen','Littleton','Conifer']},
    {'name':'Douglas County','slug':'douglas','cities':['Castle Rock','Parker','Highlands Ranch','Lone Tree','Littleton','Roxborough Park']},
    {'name':'Larimer County','slug':'larimer','cities':['Fort Collins','Loveland','Estes Park','Timnath','Windsor']},
    {'name':'Boulder County','slug':'boulder','cities':['Boulder','Longmont','Louisville','Lafayette','Broomfield','Erie']},
    {'name':'Adams County','slug':'adams','cities':['Westminster','Thornton','Commerce City','Brighton','Northglenn','Federal Heights']},
  ]},
  {'state':'Connecticut','slug':'connecticut','abbr':'CT','counties':[
    {'name':'Fairfield County','slug':'fairfield','cities':['Bridgeport','Stamford','Norwalk','Greenwich','Danbury','Trumbull','Stratford','Shelton']},
    {'name':'Hartford County','slug':'hartford','cities':['Hartford','West Hartford','Glastonbury','Simsbury','Enfield','Bloomfield','New Britain','Southington']},
    {'name':'New Haven County','slug':'new-haven','cities':['New Haven','Waterbury','Milford','West Haven','Meriden','Hamden','North Haven','Naugatuck']},
    {'name':'New London County','slug':'new-london','cities':['New London','Norwich','Groton','Waterford','Montville','Ledyard','East Lyme']},
    {'name':'Middlesex County','slug':'middlesex','cities':['Middletown','Cromwell','Middlefield','Durham','Portland','East Hampton']},
  ]},
  {'state':'Delaware','slug':'delaware','abbr':'DE','counties':[
    {'name':'New Castle County','slug':'new-castle','cities':['Wilmington','Newark','Middletown','Hockessin','Brookside','Glasgow','Pike Creek']},
    {'name':'Kent County','slug':'kent','cities':['Dover','Smyrna','Milford','Harrington','Camden','Felton']},
    {'name':'Sussex County','slug':'sussex','cities':['Rehoboth Beach','Lewes','Seaford','Milford','Georgetown','Bridgeville','Ocean View']},
  ]},
  {'state':'Florida','slug':'florida','abbr':'FL','counties':[
    {'name':'Miami-Dade County','slug':'miami-dade','cities':['Miami','Hialeah','Miami Beach','Coral Gables','Kendall','Doral','Homestead','North Miami']},
    {'name':'Broward County','slug':'broward','cities':['Fort Lauderdale','Hollywood','Pompano Beach','Coral Springs','Miramar','Sunrise','Davie','Pembroke Pines']},
    {'name':'Palm Beach County','slug':'palm-beach','cities':['West Palm Beach','Boca Raton','Delray Beach','Boynton Beach','Lake Worth','Jupiter','Wellington']},
    {'name':'Hillsborough County','slug':'hillsborough','cities':['Tampa','Brandon','Plant City','Temple Terrace','Riverview','Valrico','Westchase']},
    {'name':'Orange County','slug':'orange','cities':['Orlando','Kissimmee','Winter Park','Apopka','Ocoee','Oviedo','Winter Garden','Windermere']},
    {'name':'Pinellas County','slug':'pinellas','cities':['St. Petersburg','Clearwater','Largo','Dunedin','Tarpon Springs','Safety Harbor','Pinellas Park']},
    {'name':'Duval County','slug':'duval','cities':['Jacksonville','Jacksonville Beach','Neptune Beach','Atlantic Beach','Baldwin','Ponte Vedra']},
    {'name':'Sarasota County','slug':'sarasota','cities':['Sarasota','Venice','North Port','Osprey','Nokomis','Englewood']},
  ]},
  {'state':'Georgia','slug':'georgia','abbr':'GA','counties':[
    {'name':'Fulton County','slug':'fulton','cities':['Atlanta','Sandy Springs','Alpharetta','Roswell','Johns Creek','Milton','East Point','College Park']},
    {'name':'Gwinnett County','slug':'gwinnett','cities':['Lawrenceville','Duluth','Norcross','Lilburn','Snellville','Suwanee','Buford','Dacula']},
    {'name':'Cobb County','slug':'cobb','cities':['Marietta','Smyrna','Kennesaw','Acworth','Powder Springs','Austell','Mableton']},
    {'name':'DeKalb County','slug':'dekalb','cities':['Decatur','Dunwoody','Tucker','Stone Mountain','Clarkston','Brookhaven','Chamblee']},
    {'name':'Chatham County','slug':'chatham','cities':['Savannah','Pooler','Garden City','Port Wentworth','Tybee Island','Bloomingdale']},
    {'name':'Cherokee County','slug':'cherokee','cities':['Canton','Ball Ground','Holly Springs','Woodstock','Waleska']},
    {'name':'Forsyth County','slug':'forsyth','cities':['Cumming','Coal Mountain','Sawnee','Chestatee','Midway']},
    {'name':'Hall County','slug':'hall','cities':['Gainesville','Oakwood','Flowery Branch','Buford','Braselton','Lula']},
  ]},
  {'state':'Hawaii','slug':'hawaii','abbr':'HI','counties':[
    {'name':'Honolulu County','slug':'honolulu','cities':['Honolulu','Pearl City','Kailua','Kaneohe','Aiea','Ewa Beach','Mililani','Kapolei']},
    {'name':'Hawaii County','slug':'hawaii-county','cities':['Hilo','Kailua-Kona','Waimea','Captain Cook','Pahoa','Laupahoehoe']},
    {'name':'Maui County','slug':'maui','cities':['Kahului','Lahaina','Wailuku','Kihei','Makawao','Paia','Hana']},
    {'name':'Kauai County','slug':'kauai','cities':["Lihue","Kapaa","Hanalei","Poipu","Koloa","Princeville"]},
  ]},
  {'state':'Idaho','slug':'idaho','abbr':'ID','counties':[
    {'name':'Ada County','slug':'ada','cities':['Boise','Meridian','Garden City','Eagle','Star','Kuna']},
    {'name':'Canyon County','slug':'canyon','cities':['Nampa','Caldwell','Middleton','Wilder','Notus','Greenleaf']},
    {'name':'Kootenai County','slug':'kootenai','cities':["Coeur d'Alene",'Post Falls','Hayden','Rathdrum','Spirit Lake']},
    {'name':'Bonneville County','slug':'bonneville','cities':['Idaho Falls','Ammon','Ucon','Iona','Shelley']},
    {'name':'Twin Falls County','slug':'twin-falls','cities':['Twin Falls','Kimberly','Buhl','Filer','Hansen']},
    {'name':'Bannock County','slug':'bannock','cities':['Pocatello','Chubbuck','Inkom','Downey','Arimo']},
  ]},
  {'state':'Illinois','slug':'illinois','abbr':'IL','counties':[
    {'name':'Cook County','slug':'cook','cities':['Chicago','Evanston','Skokie','Schaumburg','Arlington Heights','Naperville','Cicero','Des Plaines']},
    {'name':'DuPage County','slug':'dupage','cities':['Naperville','Aurora','Wheaton','Downers Grove','Elmhurst','Glendale Heights','Lisle']},
    {'name':'Lake County','slug':'lake','cities':['Waukegan','North Chicago','Round Lake','Vernon Hills','Libertyville','Gurnee','Zion']},
    {'name':'Will County','slug':'will','cities':['Joliet','Bolingbrook','Romeoville','Plainfield','Lockport','New Lenox','Crest Hill']},
    {'name':'Kane County','slug':'kane','cities':['Aurora','Elgin','St. Charles','Geneva','Batavia','North Aurora','Burlington']},
    {'name':'Sangamon County','slug':'sangamon','cities':['Springfield','Sherman','Auburn','Chatham','Rochester']},
    {'name':'Winnebago County','slug':'winnebago','cities':['Rockford','Loves Park','Machesney Park','Roscoe','Belvidere']},
  ]},
  {'state':'Indiana','slug':'indiana','abbr':'IN','counties':[
    {'name':'Marion County','slug':'marion','cities':['Indianapolis','Lawrence','Beech Grove','Speedway','Southport','Cumberland']},
    {'name':'Hamilton County','slug':'hamilton','cities':['Fishers','Carmel','Noblesville','Westfield','Cicero','Arcadia']},
    {'name':'Allen County','slug':'allen','cities':['Fort Wayne','New Haven','Woodburn','Grabill','Leo-Cedarville']},
    {'name':'Lake County','slug':'lake','cities':['Gary','Hammond','Merrillville','Crown Point','Munster','Highland','Schererville']},
    {'name':'St. Joseph County','slug':'st-joseph','cities':['South Bend','Mishawaka','Granger','Osceola','New Carlisle']},
    {'name':'Hendricks County','slug':'hendricks','cities':['Plainfield','Brownsburg','Avon','Danville','Pittsboro']},
  ]},
  {'state':'Iowa','slug':'iowa','abbr':'IA','counties':[
    {'name':'Polk County','slug':'polk','cities':['Des Moines','Ankeny','West Des Moines','Urbandale','Johnston','Altoona','Pleasant Hill']},
    {'name':'Linn County','slug':'linn','cities':['Cedar Rapids','Marion','Hiawatha','Robins','Ely','Center Point']},
    {'name':'Scott County','slug':'scott','cities':['Davenport','Bettendorf','Le Claire','Princeton','Eldridge']},
    {'name':'Johnson County','slug':'johnson','cities':['Iowa City','Coralville','North Liberty','Tiffin','Hills']},
    {'name':'Black Hawk County','slug':'black-hawk','cities':['Waterloo','Cedar Falls','Evansdale','Hudson','La Porte City']},
    {'name':'Woodbury County','slug':'woodbury','cities':['Sioux City','South Sioux City','Dakota City','Sergeant Bluff','Lawton']},
  ]},
  {'state':'Kansas','slug':'kansas','abbr':'KS','counties':[
    {'name':'Johnson County','slug':'johnson','cities':['Overland Park','Olathe','Shawnee','Lenexa','Leawood','Prairie Village','Merriam']},
    {'name':'Sedgwick County','slug':'sedgwick','cities':['Wichita','Derby','Haysville','Andover','Maize','Valley Center']},
    {'name':'Wyandotte County','slug':'wyandotte','cities':['Kansas City','Bonner Springs','Edwardsville','Shawnee']},
    {'name':'Douglas County','slug':'douglas','cities':['Lawrence','Eudora','Baldwin City','Lecompton']},
    {'name':'Shawnee County','slug':'shawnee','cities':['Topeka','Silver Lake','Auburn','Rossville','Willard']},
    {'name':'Riley County','slug':'riley','cities':['Manhattan','Junction City','Ogden','Riley','Leonardville']},
  ]},
  {'state':'Kentucky','slug':'kentucky','abbr':'KY','counties':[
    {'name':'Jefferson County','slug':'jefferson','cities':['Louisville','Jeffersontown','Shively','St. Matthews','Lyndon','Okolona']},
    {'name':'Fayette County','slug':'fayette','cities':['Lexington','Nicholasville','Versailles','Winchester','Georgetown']},
    {'name':'Boone County','slug':'boone','cities':['Florence','Burlington','Union','Walton','Erlanger','Independence']},
    {'name':'Kenton County','slug':'kenton','cities':['Covington','Independence','Florence','Edgewood','Fort Wright']},
    {'name':'Warren County','slug':'warren','cities':['Bowling Green','Smiths Grove','Oakland','Plum Springs']},
    {'name':'Hardin County','slug':'hardin','cities':['Elizabethtown','Radcliff','Vine Grove','Upton','Cecilia']},
  ]},
  {'state':'Louisiana','slug':'louisiana','abbr':'LA','counties':[
    {'name':'Jefferson Parish','slug':'jefferson','cities':['Metairie','Kenner','Gretna','Harvey','Marrero','Westwego','Elmwood']},
    {'name':'Orleans Parish','slug':'orleans','cities':['New Orleans','Algiers','Gentilly','Lakeview','Mid-City','Uptown']},
    {'name':'East Baton Rouge Parish','slug':'east-baton-rouge','cities':['Baton Rouge','Zachary','Baker','Central','Westminster']},
    {'name':'St. Tammany Parish','slug':'st-tammany','cities':['Slidell','Mandeville','Covington','Madisonville','Pearl River']},
    {'name':'Lafayette Parish','slug':'lafayette','cities':['Lafayette','Broussard','Scott','Youngsville','Carencro','Duson']},
    {'name':'Caddo Parish','slug':'caddo','cities':['Shreveport','Bossier City','Blanchard','Greenwood','Mooringsport']},
  ]},
  {'state':'Maine','slug':'maine','abbr':'ME','counties':[
    {'name':'Cumberland County','slug':'cumberland','cities':['Portland','South Portland','Westbrook','Scarborough','Gorham','Cape Elizabeth','Falmouth']},
    {'name':'York County','slug':'york','cities':['Biddeford','Sanford','Saco','Kennebunk','Kittery','York','Wells']},
    {'name':'Penobscot County','slug':'penobscot','cities':['Bangor','Brewer','Orono','Old Town','Milford','Hampden']},
    {'name':'Kennebec County','slug':'kennebec','cities':['Augusta','Waterville','Gardiner','Hallowell','Winslow','Fairfield']},
    {'name':'Androscoggin County','slug':'androscoggin','cities':['Lewiston','Auburn','Lisbon','Turner','Poland','Mechanic Falls']},
  ]},
  {'state':'Maryland','slug':'maryland','abbr':'MD','counties':[
    {'name':'Montgomery County','slug':'montgomery','cities':['Rockville','Gaithersburg','Silver Spring','Bethesda','Germantown','Olney','Bowie']},
    {'name':'Prince George\'s County','slug':'prince-georges','cities':['Bowie','Laurel','College Park','Greenbelt','Hyattsville','Largo','Landover']},
    {'name':'Baltimore County','slug':'baltimore-county','cities':['Towson','Catonsville','Pikesville','Rosedale','Essex','Dundalk','Parkville']},
    {'name':'Anne Arundel County','slug':'anne-arundel','cities':['Annapolis','Glen Burnie','Pasadena','Severna Park','Odenton','Crofton','Laurel']},
    {'name':'Howard County','slug':'howard','cities':['Columbia','Ellicott City','Laurel','Jessup','Clarksville','Fulton','Elkridge']},
    {'name':'Frederick County','slug':'frederick','cities':['Frederick','Thurmont','Mount Airy','Emmitsburg','Brunswick']},
  ]},
  {'state':'Massachusetts','slug':'massachusetts','abbr':'MA','counties':[
    {'name':'Middlesex County','slug':'middlesex','cities':['Cambridge','Lowell','Newton','Waltham','Somerville','Malden','Medford','Quincy']},
    {'name':'Suffolk County','slug':'suffolk','cities':['Boston','Quincy','Braintree','Weymouth','Randolph','Holbrook']},
    {'name':'Worcester County','slug':'worcester','cities':['Worcester','Framingham','Fitchburg','Leominster','Marlborough','Gardner']},
    {'name':'Essex County','slug':'essex','cities':['Salem','Lawrence','Haverhill','Gloucester','Lynn','Beverly','Peabody','Andover']},
    {'name':'Norfolk County','slug':'norfolk','cities':['Quincy','Braintree','Brookline','Dedham','Walpole','Needham','Wellesley']},
    {'name':'Hampden County','slug':'hampden','cities':['Springfield','Chicopee','Holyoke','West Springfield','Agawam','Ludlow']},
  ]},
  {'state':'Michigan','slug':'michigan','abbr':'MI','counties':[
    {'name':'Wayne County','slug':'wayne','cities':['Detroit','Dearborn','Livonia','Westland','Taylor','Southfield','Sterling Heights','Redford']},
    {'name':'Oakland County','slug':'oakland','cities':['Troy','Rochester Hills','Pontiac','Farmington Hills','Bloomfield Hills','Royal Oak','Southfield']},
    {'name':'Macomb County','slug':'macomb','cities':['Sterling Heights','Warren','Clinton Township','Roseville','St. Clair Shores','Utica']},
    {'name':'Kent County','slug':'kent','cities':['Grand Rapids','Kentwood','Wyoming','Grandville','Caledonia','Walker','East Grand Rapids']},
    {'name':'Washtenaw County','slug':'washtenaw','cities':['Ann Arbor','Ypsilanti','Saline','Milan','Chelsea','Dexter']},
    {'name':'Ingham County','slug':'ingham','cities':['Lansing','East Lansing','Meridian Township','Haslett','Okemos','Mason']},
    {'name':'Genesee County','slug':'genesee','cities':['Flint','Burton','Flint Township','Grand Blanc','Flushing','Davison']},
  ]},
  {'state':'Minnesota','slug':'minnesota','abbr':'MN','counties':[
    {'name':'Hennepin County','slug':'hennepin','cities':['Minneapolis','Bloomington','Plymouth','Brooklyn Park','Eden Prairie','Maple Grove','Minnetonka']},
    {'name':'Ramsey County','slug':'ramsey','cities':['St. Paul','Roseville','Maplewood','New Brighton','Shoreview','Arden Hills']},
    {'name':'Dakota County','slug':'dakota','cities':['Apple Valley','Eagan','Burnsville','Inver Grove Heights','Lakeville','Rosemount']},
    {'name':'Anoka County','slug':'anoka','cities':['Blaine','Coon Rapids','Fridley','Columbia Heights','Spring Lake Park','Andover']},
    {'name':'Washington County','slug':'washington','cities':['Woodbury','Cottage Grove','Stillwater','Lake Elmo','Oakdale','Mahtomedi']},
    {'name':'Olmsted County','slug':'olmsted','cities':['Rochester','Byron','Oronoco','Stewartville','Chatfield']},
    {'name':'St. Louis County','slug':'st-louis','cities':['Duluth','Hibbing','Virginia','Two Harbors','Eveleth','Cloquet']},
  ]},
  {'state':'Mississippi','slug':'mississippi','abbr':'MS','counties':[
    {'name':'Hinds County','slug':'hinds','cities':['Jackson','Clinton','Byram','Raymond','Terry','Bolton']},
    {'name':'Harrison County','slug':'harrison','cities':['Gulfport','Biloxi','Long Beach','D\'Iberville','Pass Christian','Saucier']},
    {'name':'DeSoto County','slug':'desoto','cities':['Southaven','Horn Lake','Olive Branch','Hernando','Walls','Nesbit']},
    {'name':'Rankin County','slug':'rankin','cities':['Flowood','Brandon','Richland','Pearl','Florence','Byram']},
    {'name':'Madison County','slug':'madison','cities':['Madison','Ridgeland','Canton','Gluckstadt','Flora','Ridgeland']},
    {'name':'Jackson County','slug':'jackson','cities':['Pascagoula','Moss Point','Ocean Springs','Gautier','Escatawpa']},
  ]},
  {'state':'Missouri','slug':'missouri','abbr':'MO','counties':[
    {'name':'Jackson County','slug':'jackson','cities':['Kansas City','Independence','Lee\'s Summit','Blue Springs','Raytown','Grandview']},
    {'name':'St. Louis County','slug':'st-louis','cities':['Clayton','Florissant','Chesterfield','Ballwin','Kirkwood','Manchester','Creve Coeur']},
    {'name':'Greene County','slug':'greene','cities':['Springfield','Republic','Ozark','Willard','Battlefield','Rogersville']},
    {'name':'St. Charles County','slug':'st-charles','cities':['St. Charles','O\'Fallon','St. Peters','Wentzville','Lake Saint Louis','Cottleville']},
    {'name':'Jefferson County','slug':'jefferson','cities':['Arnold','Festus','De Soto','Hillsboro','Imperial','High Ridge']},
    {'name':'Boone County','slug':'boone','cities':['Columbia','Ashland','Hallsville','Centralia','Sturgeon']},
  ]},
  {'state':'Montana','slug':'montana','abbr':'MT','counties':[
    {'name':'Yellowstone County','slug':'yellowstone','cities':['Billings','Lockwood','Laurel','Broadview','Columbus']},
    {'name':'Cascade County','slug':'cascade','cities':['Great Falls','Black Eagle','Belt','Ulm','Cascade']},
    {'name':'Missoula County','slug':'missoula','cities':['Missoula','Lolo','Frenchtown','Seeley Lake','Clinton']},
    {'name':'Gallatin County','slug':'gallatin','cities':['Bozeman','Belgrade','Manhattan','Three Forks','West Yellowstone']},
    {'name':'Flathead County','slug':'flathead','cities':['Kalispell','Whitefish','Columbia Falls','Bigfork','Lakeside']},
    {'name':'Lewis and Clark County','slug':'lewis-and-clark','cities':['Helena','East Helena','Clancy','Marysville']},
  ]},
  {'state':'Nebraska','slug':'nebraska','abbr':'NE','counties':[
    {'name':'Douglas County','slug':'douglas','cities':['Omaha','Waterloo','Valley','Bennington','Ralston','La Vista']},
    {'name':'Lancaster County','slug':'lancaster','cities':['Lincoln','Waverly','Hickman','Bennet','Malcolm','Raymond']},
    {'name':'Sarpy County','slug':'sarpy','cities':['Papillion','Bellevue','La Vista','Gretna','Springfield','Offutt']},
    {'name':'Hall County','slug':'hall','cities':['Grand Island','Alda','Cairo','Wood River','Doniphan']},
    {'name':'Buffalo County','slug':'buffalo','cities':['Kearney','Gibbon','Ravenna','Shelton','Elm Creek']},
    {'name':'Madison County','slug':'madison','cities':['Norfolk','Madison','Battle Creek','Newman Grove']},
  ]},
  {'state':'Nevada','slug':'nevada','abbr':'NV','counties':[
    {'name':'Clark County','slug':'clark','cities':['Las Vegas','Henderson','North Las Vegas','Boulder City','Mesquite','Enterprise','Summerlin']},
    {'name':'Washoe County','slug':'washoe','cities':['Reno','Sparks','Sun Valley','Incline Village','Cold Springs','Spanish Springs']},
    {'name':'Carson City','slug':'carson-city','cities':['Carson City','Minden','Gardnerville','Genoa','Ranchos']},
    {'name':'Elko County','slug':'elko','cities':['Elko','Spring Creek','Carlin','Wells','Wendover']},
    {'name':'Douglas County','slug':'douglas','cities':['Minden','Gardnerville','Stateline','Genoa','Johnson Lane']},
  ]},
  {'state':'New Hampshire','slug':'new-hampshire','abbr':'NH','counties':[
    {'name':'Hillsborough County','slug':'hillsborough','cities':['Manchester','Nashua','Merrimack','Milford','Amherst','Hudson','Goffstown']},
    {'name':'Rockingham County','slug':'rockingham','cities':['Derry','Salem','Londonderry','Windham','Portsmouth','Exeter','Hampton']},
    {'name':'Strafford County','slug':'strafford','cities':['Dover','Rochester','Somersworth','Durham','Barrington','Rollinsford']},
    {'name':'Merrimack County','slug':'merrimack','cities':['Concord','Bow','Hooksett','Pembroke','Northfield','Pittsfield']},
    {'name':'Cheshire County','slug':'cheshire','cities':['Keene','Swanzey','Walpole','Winchester','Jaffrey','Marlborough']},
  ]},
  {'state':'New Jersey','slug':'new-jersey','abbr':'NJ','counties':[
    {'name':'Bergen County','slug':'bergen','cities':['Hackensack','Paramus','Fort Lee','Englewood','Teaneck','Clifton','Ridgewood']},
    {'name':'Middlesex County','slug':'middlesex','cities':['New Brunswick','Edison','Woodbridge','East Brunswick','Piscataway','Sayreville','Old Bridge']},
    {'name':'Essex County','slug':'essex','cities':['Newark','Montclair','East Orange','Irvington','Bloomfield','Nutley','West Orange']},
    {'name':'Hudson County','slug':'hudson','cities':['Jersey City','Hoboken','Bayonne','Union City','Kearny','West New York','Secaucus']},
    {'name':'Monmouth County','slug':'monmouth','cities':['Freehold','Asbury Park','Red Bank','Long Branch','Toms River','Holmdel','Manalapan']},
    {'name':'Union County','slug':'union','cities':['Elizabeth','Union','Linden','Plainfield','Summit','Westfield','Cranford']},
    {'name':'Morris County','slug':'morris','cities':['Morristown','Parsippany','Rockaway','Dover','Madison','Randolph','Mount Olive']},
  ]},
  {'state':'New Mexico','slug':'new-mexico','abbr':'NM','counties':[
    {'name':'Bernalillo County','slug':'bernalillo','cities':['Albuquerque','Rio Rancho','Corrales','Los Ranchos','Tijeras']},
    {'name':'Doña Ana County','slug':'dona-ana','cities':['Las Cruces','Sunland Park','Anthony','Hatch','Mesilla']},
    {'name':'Santa Fe County','slug':'santa-fe','cities':['Santa Fe','Espanola','Pojoaque','Tesuque','Agua Fria']},
    {'name':'Sandoval County','slug':'sandoval','cities':['Rio Rancho','Bernalillo','Placitas','Corrales','Cuba']},
    {'name':'San Juan County','slug':'san-juan','cities':['Farmington','Aztec','Bloomfield','Flora Vista','Cedar Hill']},
  ]},
  {'state':'New York','slug':'new-york','abbr':'NY','counties':[
    {'name':'New York County (Manhattan)','slug':'new-york-county','cities':['Manhattan','Midtown','Downtown','Harlem','Upper East Side','Upper West Side']},
    {'name':'Kings County (Brooklyn)','slug':'kings','cities':['Brooklyn','Williamsburg','Park Slope','Bay Ridge','Flatbush','Sunset Park','DUMBO']},
    {'name':'Queens County','slug':'queens','cities':['Flushing','Jamaica','Astoria','Forest Hills','Jackson Heights','Bayside','Long Island City']},
    {'name':'Nassau County','slug':'nassau','cities':['Hempstead','Garden City','Levittown','Valley Stream','Freeport','Oceanside','Long Beach']},
    {'name':'Suffolk County','slug':'suffolk','cities':['Babylon','Islip','Brookhaven','Huntington','Smithtown','Southampton','Riverhead']},
    {'name':'Westchester County','slug':'westchester','cities':['White Plains','Yonkers','New Rochelle','Mount Vernon','Peekskill','Ossining']},
    {'name':'Erie County','slug':'erie','cities':['Buffalo','Amherst','Cheektowaga','Tonawanda','Lackawanna','West Seneca','Lancaster']},
    {'name':'Monroe County','slug':'monroe','cities':['Rochester','Greece','Brighton','Henrietta','Irondequoit','Webster','Penfield']},
  ]},
  {'state':'North Carolina','slug':'north-carolina','abbr':'NC','counties':[
    {'name':'Mecklenburg County','slug':'mecklenburg','cities':['Charlotte','Huntersville','Concord','Davidson','Pineville','Matthews','Mint Hill']},
    {'name':'Wake County','slug':'wake','cities':['Raleigh','Cary','Morrisville','Apex','Holly Springs','Garner','Fuquay-Varina']},
    {'name':'Guilford County','slug':'guilford','cities':['Greensboro','High Point','Jamestown','Whitsett','Gibsonville']},
    {'name':'Forsyth County','slug':'forsyth','cities':['Winston-Salem','Kernersville','Clemmons','Lewisville','Walkertown']},
    {'name':'Durham County','slug':'durham','cities':['Durham','Chapel Hill','Research Triangle Park','Carrboro','Bahama']},
    {'name':'Buncombe County','slug':'buncombe','cities':['Asheville','Weaverville','Arden','Black Mountain','Swannanoa']},
    {'name':'Cumberland County','slug':'cumberland','cities':['Fayetteville','Hope Mills','Spring Lake','Eastover','Godwin']},
    {'name':'Cabarrus County','slug':'cabarrus','cities':['Concord','Kannapolis','Harrisburg','Mt. Pleasant','Midland']},
  ]},
  {'state':'North Dakota','slug':'north-dakota','abbr':'ND','counties':[
    {'name':'Cass County','slug':'cass','cities':['Fargo','West Fargo','Horace','Mapleton','Casselton']},
    {'name':'Burleigh County','slug':'burleigh','cities':['Bismarck','Lincoln','Mandan','Wilton','Menoken']},
    {'name':'Grand Forks County','slug':'grand-forks','cities':['Grand Forks','East Grand Forks','Thompson','Emerado','Larimore']},
    {'name':'Ward County','slug':'ward','cities':['Minot','Burlington','Surrey','Des Lacs','Kenmare']},
    {'name':'Morton County','slug':'morton','cities':['Mandan','St. Anthony','Flasher','Hebron','Shields']},
  ]},
  {'state':'Ohio','slug':'ohio','abbr':'OH','counties':[
    {'name':'Franklin County','slug':'franklin','cities':['Columbus','Dublin','Grove City','Hilliard','Westerville','Gahanna','Reynoldsburg']},
    {'name':'Cuyahoga County','slug':'cuyahoga','cities':['Cleveland','Parma','Lakewood','Strongsville','Euclid','Brooklyn','Maple Heights']},
    {'name':'Hamilton County','slug':'hamilton','cities':['Cincinnati','Norwood','Blue Ash','Hyde Park','Cheviot','Madeira']},
    {'name':'Summit County','slug':'summit','cities':['Akron','Cuyahoga Falls','Barberton','Stow','Tallmadge','Hudson','Twinsburg']},
    {'name':'Montgomery County','slug':'montgomery','cities':['Dayton','Kettering','Huber Heights','Beavercreek','Centerville','Miamisburg']},
    {'name':'Lucas County','slug':'lucas','cities':['Toledo','Sylvania','Perrysburg','Maumee','Oregon','Holland','Rossford']},
    {'name':'Stark County','slug':'stark','cities':['Canton','Massillon','North Canton','Alliance','Louisville','Barberton']},
  ]},
  {'state':'Oklahoma','slug':'oklahoma','abbr':'OK','counties':[
    {'name':'Oklahoma County','slug':'oklahoma','cities':['Oklahoma City','Edmond','Midwest City','Del City','Moore','Mustang','Yukon']},
    {'name':'Tulsa County','slug':'tulsa','cities':['Tulsa','Broken Arrow','Owasso','Bixby','Jenks','Sand Springs','Sapulpa']},
    {'name':'Cleveland County','slug':'cleveland','cities':['Norman','Moore','Midwest City','Noble','Lexington']},
    {'name':'Canadian County','slug':'canadian','cities':['Yukon','Mustang','El Reno','Weatherford','Piedmont']},
    {'name':'Comanche County','slug':'comanche','cities':['Lawton','Cache','Fletcher','Cyril','Elgin']},
    {'name':'Rogers County','slug':'rogers','cities':['Claremore','Catoosa','Owasso','Verdigris','Inola']},
  ]},
  {'state':'Oregon','slug':'oregon','abbr':'OR','counties':[
    {'name':'Multnomah County','slug':'multnomah','cities':['Portland','Gresham','Troutdale','Fairview','Maywood Park']},
    {'name':'Washington County','slug':'washington','cities':['Hillsboro','Beaverton','Tigard','Tualatin','Sherwood','Forest Grove','Wilsonville']},
    {'name':'Clackamas County','slug':'clackamas','cities':['Lake Oswego','West Linn','Happy Valley','Milwaukie','Oregon City','Canby']},
    {'name':'Lane County','slug':'lane','cities':['Eugene','Springfield','Florence','Creswell','Cottage Grove','Junction City']},
    {'name':'Marion County','slug':'marion','cities':['Salem','Keizer','Woodburn','Stayton','Silverton','Dallas']},
    {'name':'Deschutes County','slug':'deschutes','cities':['Bend','Redmond','Sisters','La Pine','Sunriver','Tumalo']},
    {'name':'Jackson County','slug':'jackson','cities':['Medford','Ashland','Jacksonville','Grants Pass','Phoenix','Talent']},
  ]},
  {'state':'Pennsylvania','slug':'pennsylvania','abbr':'PA','counties':[
    {'name':'Philadelphia County','slug':'philadelphia','cities':['Philadelphia','Northeast Philadelphia','South Philadelphia','West Philadelphia','Fishtown','Manayunk']},
    {'name':'Allegheny County','slug':'allegheny','cities':['Pittsburgh','McKeesport','Bethel Park','Mt. Lebanon','Monroeville','Murrysville']},
    {'name':'Montgomery County','slug':'montgomery','cities':['Norristown','Plymouth Meeting','Horsham','Lansdale','Hatfield','Blue Bell','Ambler']},
    {'name':'Bucks County','slug':'bucks','cities':['Levittown','Bristol','Quakertown','Doylestown','Newtown','Warminster','Chalfont']},
    {'name':'Chester County','slug':'chester','cities':['West Chester','Coatesville','Downingtown','Malvern','Exton','Phoenixville','Oxford']},
    {'name':'Lancaster County','slug':'lancaster','cities':['Lancaster','Lititz','Ephrata','Leola','Manheim','Millersville','Elizabethtown']},
    {'name':'York County','slug':'york','cities':['York','Hanover','Red Lion','Spring Grove','Dallastown','Dover','East York']},
  ]},
  {'state':'Rhode Island','slug':'rhode-island','abbr':'RI','counties':[
    {'name':'Providence County','slug':'providence','cities':['Providence','Woonsocket','Pawtucket','Central Falls','Johnston','North Providence','Cranston']},
    {'name':'Kent County','slug':'kent','cities':['Warwick','Coventry','East Greenwich','West Warwick','Apponaug','Arctic']},
    {'name':'Washington County','slug':'washington','cities':['Westerly','Narragansett','South Kingstown','Charlestown','Hopkinton','Richmond']},
    {'name':'Newport County','slug':'newport','cities':['Newport','Middletown','Portsmouth','Tiverton','Little Compton','Jamestown']},
    {'name':'Bristol County','slug':'bristol','cities':['Bristol','Barrington','Warren','Bristol Highlands']},
  ]},
  {'state':'South Carolina','slug':'south-carolina','abbr':'SC','counties':[
    {'name':'Greenville County','slug':'greenville','cities':['Greenville','Greer','Simpsonville','Mauldin','Taylors','Fountain Inn','Travelers Rest']},
    {'name':'Richland County','slug':'richland','cities':['Columbia','Blythewood','Forest Acres','Hopkins','Dentsville','Irmo']},
    {'name':'Charleston County','slug':'charleston','cities':['Charleston','North Charleston','Mount Pleasant','Summerville','Goose Creek','James Island']},
    {'name':'Horry County','slug':'horry','cities':['Myrtle Beach','Conway','Surfside Beach','North Myrtle Beach','Socastee','Carolina Forest']},
    {'name':'Spartanburg County','slug':'spartanburg','cities':['Spartanburg','Greer','Boiling Springs','Gaffney','Duncan','Inman']},
    {'name':'York County','slug':'york','cities':['Rock Hill','Fort Mill','Clover','Lake Wylie','Tega Cay','York']},
    {'name':'Lexington County','slug':'lexington','cities':['Lexington','West Columbia','Cayce','Chapin','Irmo','Batesburg-Leesville']},
  ]},
  {'state':'South Dakota','slug':'south-dakota','abbr':'SD','counties':[
    {'name':'Minnehaha County','slug':'minnehaha','cities':['Sioux Falls','Brandon','Renner','Harrisburg','Hartford','Crooks']},
    {'name':'Pennington County','slug':'pennington','cities':['Rapid City','Box Elder','Summerset','Piedmont','Meade','New Underwood']},
    {'name':'Lincoln County','slug':'lincoln','cities':['Tea','Harrisburg','Canton','Dell Rapids','Worthing']},
    {'name':'Brown County','slug':'brown','cities':['Aberdeen','Hecla','Groton','Bath','Columbia']},
    {'name':'Codington County','slug':'codington','cities':['Watertown','Florence','Henry','Waverly','South Shore']},
  ]},
  {'state':'Tennessee','slug':'tennessee','abbr':'TN','counties':[
    {'name':'Shelby County','slug':'shelby','cities':['Memphis','Germantown','Bartlett','Collierville','Cordova','Arlington','Lakeland']},
    {'name':'Davidson County','slug':'davidson','cities':['Nashville','Brentwood','Goodlettsville','Antioch','Madison','Bellevue']},
    {'name':'Knox County','slug':'knox','cities':['Knoxville','Farragut','Powell','Halls','Corryton','Mascot']},
    {'name':'Hamilton County','slug':'hamilton','cities':['Chattanooga','Hixson','Red Bank','East Ridge','Signal Mountain','Soddy-Daisy']},
    {'name':'Rutherford County','slug':'rutherford','cities':['Murfreesboro','Smyrna','La Vergne','Eagleville','Christiana']},
    {'name':'Williamson County','slug':'williamson','cities':['Franklin','Brentwood','Spring Hill','Nolensville','Thompson\'s Station']},
    {'name':'Sullivan County','slug':'sullivan','cities':['Kingsport','Bristol','Blountville','Piney Flats','Holston Valley']},
  ]},
  {'state':'Texas','slug':'texas','abbr':'TX','counties':[
    {'name':'Harris County','slug':'harris','cities':['Houston','Pasadena','Katy','Pearland','Sugar Land','Baytown','Missouri City','League City']},
    {'name':'Dallas County','slug':'dallas','cities':['Dallas','Plano','Irving','Garland','Mesquite','Richardson','Carrollton','Grand Prairie']},
    {'name':'Tarrant County','slug':'tarrant','cities':['Fort Worth','Arlington','Irving','Grapevine','Colleyville','Southlake','Mansfield','Bedford']},
    {'name':'Travis County','slug':'travis','cities':['Austin','Round Rock','Cedar Park','Pflugerville','Lago Vista','Sunset Valley','Manor']},
    {'name':'Bexar County','slug':'bexar','cities':['San Antonio','Leon Valley','Converse','Helotes','Schertz','Universal City','Windcrest']},
    {'name':'Collin County','slug':'collin','cities':['Plano','McKinney','Allen','Frisco','Murphy','Prosper','Wylie','Celina']},
    {'name':'Fort Bend County','slug':'fort-bend','cities':['Sugar Land','Missouri City','Rosenberg','Pearland','Stafford','Richmond','Katy']},
    {'name':'Denton County','slug':'denton','cities':['Denton','Frisco','Lewisville','Flower Mound','Carrollton','The Colony','Little Elm']},
  ]},
  {'state':'Utah','slug':'utah','abbr':'UT','counties':[
    {'name':'Salt Lake County','slug':'salt-lake','cities':['Salt Lake City','West Valley City','Sandy','South Jordan','Murray','Millcreek','Taylorsville']},
    {'name':'Utah County','slug':'utah-county','cities':['Provo','Orem','Lehi','American Fork','Spanish Fork','Springville','Mapleton']},
    {'name':'Davis County','slug':'davis','cities':['Layton','Bountiful','Kaysville','Centerville','Clinton','Clearfield','Syracuse']},
    {'name':'Weber County','slug':'weber','cities':['Ogden','Roy','Washington Terrace','South Ogden','Riverdale','Harrisville']},
    {'name':'Washington County','slug':'washington','cities':['St. George','Washington','Hurricane','Ivins','Santa Clara','La Verkin']},
    {'name':'Cache County','slug':'cache','cities':['Logan','North Logan','Hyde Park','Smithfield','Providence','River Heights']},
  ]},
  {'state':'Vermont','slug':'vermont','abbr':'VT','counties':[
    {'name':'Chittenden County','slug':'chittenden','cities':['Burlington','South Burlington','Williston','Colchester','Winooski','Essex Junction','Shelburne']},
    {'name':'Rutland County','slug':'rutland','cities':['Rutland','Castleton','Brandon','Fair Haven','Proctor','Poultney']},
    {'name':'Washington County','slug':'washington','cities':['Montpelier','Barre','Northfield','Waterbury','Berlin','Moretown']},
    {'name':'Caledonia County','slug':'caledonia','cities':['St. Johnsbury','Lyndonville','Hardwick','Barnet','Danville']},
    {'name':'Franklin County','slug':'franklin','cities':['St. Albans','Swanton','Enosburg Falls','Fairfax','Georgia']},
  ]},
  {'state':'Virginia','slug':'virginia','abbr':'VA','counties':[
    {'name':'Fairfax County','slug':'fairfax','cities':['Fairfax','Reston','Herndon','McLean','Tysons','Springfield','Centreville','Chantilly']},
    {'name':'Prince William County','slug':'prince-william','cities':['Woodbridge','Dale City','Lake Ridge','Manassas','Gainesville','Haymarket']},
    {'name':'Loudoun County','slug':'loudoun','cities':['Ashburn','Sterling','Leesburg','Lansdowne','Dulles','Cascades','Brambleton']},
    {'name':'Chesterfield County','slug':'chesterfield','cities':['Richmond','Midlothian','Bon Air','Chester','Colonial Heights','Ettrick']},
    {'name':'Henrico County','slug':'henrico','cities':['Glen Allen','Short Pump','Henrico','Highland Springs','Tuckahoe','Sandston']},
    {'name':'Arlington County','slug':'arlington','cities':['Arlington','Crystal City','Rosslyn','Ballston','Clarendon','Pentagon City']},
    {'name':'Virginia Beach City','slug':'virginia-beach','cities':['Virginia Beach','Great Neck','Kempsville','Chesapeake','Sandbridge']},
  ]},
  {'state':'Washington','slug':'washington','abbr':'WA','counties':[
    {'name':'King County','slug':'king','cities':['Seattle','Bellevue','Kirkland','Redmond','Renton','Bothell','Sammamish','Kent']},
    {'name':'Pierce County','slug':'pierce','cities':['Tacoma','Lakewood','Federal Way','Puyallup','Bonney Lake','Sumner','Auburn']},
    {'name':'Snohomish County','slug':'snohomish','cities':['Everett','Lynnwood','Marysville','Edmonds','Mukilteo','Mountlake Terrace','Mill Creek']},
    {'name':'Spokane County','slug':'spokane','cities':['Spokane','Spokane Valley','Mead','Deer Park','Medical Lake','Airway Heights']},
    {'name':'Clark County','slug':'clark','cities':['Vancouver','Camas','Battle Ground','Washougal','Ridgefield','La Center']},
    {'name':'Thurston County','slug':'thurston','cities':['Olympia','Lacey','Tumwater','Yelm','Rainier','Tenino']},
    {'name':'Whatcom County','slug':'whatcom','cities':['Bellingham','Ferndale','Lynden','Blaine','Birch Bay','Birchwood']},
  ]},
  {'state':'West Virginia','slug':'west-virginia','abbr':'WV','counties':[
    {'name':'Kanawha County','slug':'kanawha','cities':['Charleston','South Charleston','Dunbar','St. Albans','Nitro','Sissonville']},
    {'name':'Cabell County','slug':'cabell','cities':['Huntington','Barboursville','Kenova','Huntington East','Glenwood']},
    {'name':'Berkeley County','slug':'berkeley','cities':['Martinsburg','Hedgesville','Inwood','Falling Waters','Bunker Hill']},
    {'name':'Wood County','slug':'wood','cities':['Parkersburg','Vienna','Williamstown','Belpre','Waverly']},
    {'name':'Monongalia County','slug':'monongalia','cities':['Morgantown','Westover','Star City','Granville','Cheat Lake']},
    {'name':'Raleigh County','slug':'raleigh','cities':['Beckley','Beaver','Mount Hope','Sophia','Daniels','Oak Hill']},
  ]},
  {'state':'Wisconsin','slug':'wisconsin','abbr':'WI','counties':[
    {'name':'Milwaukee County','slug':'milwaukee','cities':['Milwaukee','Wauwatosa','West Allis','Greenfield','Oak Creek','Franklin','Cudahy']},
    {'name':'Dane County','slug':'dane','cities':['Madison','Sun Prairie','Fitchburg','Middleton','Verona','Monona','Stoughton']},
    {'name':'Waukesha County','slug':'waukesha','cities':['Waukesha','Brookfield','New Berlin','Oconomowoc','Menomonee Falls','Pewaukee']},
    {'name':'Brown County','slug':'brown','cities':['Green Bay','De Pere','Allouez','Bellevue','Ashwaubenon','Howard']},
    {'name':'Racine County','slug':'racine','cities':['Racine','Mount Pleasant','Caledonia','Burlington','Sturtevant','Waterford']},
    {'name':'Outagamie County','slug':'outagamie','cities':['Appleton','Kaukauna','Little Chute','Wrightstown','Seymour','Combined Locks']},
    {'name':'Winnebago County','slug':'winnebago','cities':['Oshkosh','Neenah','Menasha','Appleton','Butte des Morts','Omro']},
  ]},
  {'state':'Wyoming','slug':'wyoming','abbr':'WY','counties':[
    {'name':'Laramie County','slug':'laramie','cities':['Cheyenne','Burns','Carpenter','Pine Bluffs','Albin']},
    {'name':'Natrona County','slug':'natrona','cities':['Casper','Mills','Bar Nunn','Evansville','Midwest']},
    {'name':'Campbell County','slug':'campbell','cities':['Gillette','Wright','Moorcroft','Rozet','Recluse']},
    {'name':'Albany County','slug':'albany','cities':['Laramie','Centennial','Rock River','Garrett','Bosler']},
    {'name':'Sweetwater County','slug':'sweetwater','cities':['Rock Springs','Green River','Rawlins','Superior','Point of Rocks']},
    {'name':'Sheridan County','slug':'sheridan','cities':['Sheridan','Ranchester','Clearmont','Dayton','Big Horn']},
  ]},
]

# ── Templates ─────────────────────────────────────────────────────────────────
NAV = '''<nav>
  <div class="nav-inner">
    <a href="/"><img src="/assets/logo-dark.png" alt="Nexvora Systems" style="height:56px;width:auto;display:block;"/></a>
    <ul class="nav-links">
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
      <li class="nav-has-dropdown"><a href="/services">Services</a>
        <div class="nav-dropdown"><div class="nav-dd-inner">
          <div class="nav-dd-left">
            <a href="/services/operations-business-systems" class="nav-dd-item" data-sub="ops">Operations &amp; Business Systems <span class="dd-chevron">›</span></a>
            <a href="/services/ai-automation" class="nav-dd-item" data-sub="ai">AI &amp; Automation <span class="dd-chevron">›</span></a>
            <a href="/services/marketing-leads" class="nav-dd-item" data-sub="mkt">Marketing &amp; Lead Generation <span class="dd-chevron">›</span></a>
            <a href="/services/web-design" class="nav-dd-item" data-sub="web">Web Design &amp; Digital Presence <span class="dd-chevron">›</span></a>
          </div>
          <div class="nav-dd-right-outer"><div class="nav-dd-right">
            <div class="nav-dd-sub" id="dd-sub-ops"><a href="/services/operations-business-systems" class="dd-view-all">View all →</a><a href="/services/operations/process-sops">Process &amp; SOPs</a><a href="/services/operations/sales-systems">Sales Systems</a><a href="/services/operations/team-hr">Team &amp; HR</a><a href="/services/operations/financial-clarity">Financial Clarity</a></div>
            <div class="nav-dd-sub" id="dd-sub-ai"><a href="/services/ai-automation" class="dd-view-all">View all →</a><a href="/services/ai/workflow-automation">Workflow Automation</a><a href="/services/ai/chatbots-bots">AI Chatbots &amp; Bots</a><a href="/services/ai/crm-integrations">CRM &amp; Tool Integrations</a><a href="/services/ai/reporting-dashboards">Reporting &amp; Dashboards</a></div>
            <div class="nav-dd-sub" id="dd-sub-mkt"><a href="/services/marketing-leads" class="dd-view-all">View all →</a><a href="/services/marketing/lead-generation-systems">Lead Generation Systems</a><a href="/services/marketing/paid-advertising">Paid Advertising</a><a href="/services/marketing/content-seo">Content &amp; SEO</a></div>
            <div class="nav-dd-sub" id="dd-sub-web"><a href="/services/web-design" class="dd-view-all">View all →</a><a href="/services/web/website-design-development">Website Design &amp; Development</a><a href="/services/web/copywriting-messaging">Copywriting &amp; Messaging</a><a href="/services/web/brand-identity">Brand Identity</a></div>
          </div></div>
        </div></div>
      </li>
      <li><a href="/blog">Insights</a></li>
      <li><a href="/contact">Contact</a></li>
    </ul>
    <button class="nav-cta" data-discovery-trigger>Get My Free Call</button>
    <button class="hamburger" id="hamburger" aria-label="Open menu"><span></span><span></span><span></span></button>
  </div>
</nav>
<div class="mobile-menu" id="mobileMenu">
  <a href="/">Home</a><a href="/about">About</a>
  <div class="mobile-svc-wrap">
    <button class="mobile-svc-toggle" onclick="this.parentElement.classList.toggle('open')">Services <span class="mobile-svc-arrow">›</span></button>
    <div class="mobile-svc-list">
      <a href="/services/operations-business-systems">Operations &amp; Business Systems</a>
      <a href="/services/ai-automation">AI &amp; Automation</a>
      <a href="/services/marketing-leads">Marketing &amp; Lead Generation</a>
      <a href="/services/web-design">Web Design &amp; Digital Presence</a>
    </div>
  </div>
  <a href="/blog">Insights</a><a href="/contact">Contact</a>
  <button class="mobile-cta" data-discovery-trigger>Get My Free Call</button>
</div>'''

HAMBURGER_JS = '''(function(){var ham=document.getElementById('hamburger');var menu=document.getElementById('mobileMenu');var bd=document.createElement('div');bd.className='nx-mob-bd';document.body.appendChild(bd);var closeBtn=document.createElement('button');closeBtn.className='nx-mob-close';closeBtn.innerHTML='&times;';closeBtn.setAttribute('aria-label','Close menu');menu.appendChild(closeBtn);function openMenu(){ham.classList.add('open');menu.classList.add('open');bd.classList.add('open');document.body.style.overflow='hidden';}function closeMenu(){ham.classList.remove('open');menu.classList.remove('open');bd.classList.remove('open');document.body.style.overflow='';}ham.addEventListener('click',function(){menu.classList.contains('open')?closeMenu():openMenu();});bd.addEventListener('click',closeMenu);closeBtn.addEventListener('click',closeMenu);})();
(function(){var items=document.querySelectorAll('.nav-dd-item');var outer=document.querySelector('.nav-dd-right-outer');var timer;function reset(){items.forEach(function(i){i.classList.remove('dd-active');});document.querySelectorAll('.nav-dd-sub').forEach(function(s){s.classList.remove('dd-active');});if(outer){outer.classList.remove('dd-show');}}items.forEach(function(item){item.addEventListener('mouseenter',function(){clearTimeout(timer);items.forEach(function(i){i.classList.remove('dd-active');});document.querySelectorAll('.nav-dd-sub').forEach(function(s){s.classList.remove('dd-active');});item.classList.add('dd-active');var sub=document.getElementById('dd-sub-'+item.getAttribute('data-sub'));if(sub){sub.classList.add('dd-active');}if(outer){outer.classList.add('dd-show');}});});var wrap=document.querySelector('.nav-has-dropdown');if(wrap){wrap.addEventListener('mouseleave',function(){timer=setTimeout(reset,400);});wrap.addEventListener('mouseenter',function(){clearTimeout(timer);});}})();'''

FOOTER = '''<footer>
  <div class="footer-inner">
    <div class="footer-grid">
      <div class="footer-brand">
        <a href="/"><strong style="font-size:19px;font-weight:800;color:#FAF8F5;text-decoration:none;">Nexvora<span style="color:#0D9488;">.</span></strong></a>
        <p style="margin-top:10px;font-size:13px;color:rgba(250,248,245,0.5);">AI-powered operational consulting for small and growing businesses.</p>
        <p style="margin-top:8px;font-size:13px;"><a href="mailto:info@nexvorasystems.us" style="color:rgba(250,248,245,0.5);text-decoration:none;">info@nexvorasystems.us</a></p>
        <p style="margin-top:4px;font-size:13px;"><a href="tel:+18136676464" style="color:rgba(250,248,245,0.5);text-decoration:none;">(813) 667-6464</a></p>
        <address style="margin-top:10px;font-style:normal;font-size:12px;color:rgba(250,248,245,0.4);line-height:1.7;">7901 4th St N<br>St. Petersburg, FL 33702</address>
        <p style="margin-top:8px;font-size:11px;color:rgba(250,248,245,0.3);">Serving businesses across all 50 states</p>
      </div>
      <div>
        <p class="footer-col-title">Services</p>
        <div class="footer-links">
          <a href="/services/operations-business-systems">Operations &amp; Business Systems</a>
          <a href="/services/ai-automation">AI &amp; Automation</a>
          <a href="/services/marketing-leads">Marketing &amp; Lead Generation</a>
          <a href="/services/web-design">Web Design</a>
        </div>
      </div>
      <div>
        <p class="footer-col-title">Company</p>
        <div class="footer-links">
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
          <a href="/faq">FAQ</a>
        </div>
      </div>
      <div>
        <p class="footer-col-title">Service Areas</p>
        <div class="footer-links">
          <a href="/service-areas">All 50 States →</a>
          <a href="/service-areas/florida">Florida</a>
          <a href="/service-areas/texas">Texas</a>
          <a href="/service-areas/california">California</a>
          <a href="/service-areas/new-york">New York</a>
          <a href="/service-areas/georgia">Georgia</a>
          <a href="/service-areas/north-carolina">North Carolina</a>
          <a href="/service-areas/illinois">Illinois</a>
          <a href="/service-areas/pennsylvania">Pennsylvania</a>
        </div>
      </div>
    </div>
    <div class="footer-bottom"><span>&copy; 2026 Nexvora Systems LLC. All rights reserved.</span></div>
  </div>
</footer>'''

CSS = '''*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{--bg:#FAF8F5;--bg-surface:#F0EDE8;--bg-card:#FFFFFF;--text:#1A1A2E;--muted:#4A5568;--dim:#718096;--border:#E2DDD5;--teal:#0D9488;--teal-lt:rgba(13,148,136,0.1);--navy:#0F2B4C;--radius:12px;--nav-h:76px;}
html,body{font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;background:var(--bg);color:var(--text);}
nav{position:fixed;top:0;left:0;right:0;z-index:200;height:var(--nav-h);display:flex;align-items:center;background:rgba(250,248,245,0.92);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);padding:0 44px;}
.nav-inner{display:flex;align-items:center;width:100%;}
.nav-links{display:flex;gap:28px;list-style:none;margin:0 auto;}.nav-links a{font-size:16px;color:var(--muted);text-decoration:none;transition:color .18s,background .18s;padding:6px 14px;border-radius:100px;}.nav-links a:hover{color:var(--teal);background:rgba(13,148,136,0.1);}
.nav-cta{padding:9px 22px;border-radius:9px;background:var(--teal);color:#fff;font-size:13px;font-weight:700;border:none;cursor:pointer;transition:all .18s;white-space:nowrap;}
.nav-cta:hover{filter:brightness(1.08);transform:translateY(-1px);}
.nav-has-dropdown{position:relative;padding-bottom:10px;margin-bottom:-10px;}
.nav-dropdown{visibility:hidden;opacity:0;pointer-events:none;position:absolute;top:calc(100% + 2px);left:50%;margin-left:-125px;transform:translateY(-4px) scale(0.96);transform-origin:top center;background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:18px;padding:10px 0 0;overflow:hidden;min-width:240px;box-shadow:0 24px 64px rgba(0,0,0,0.13);z-index:300;transition:opacity .3s cubic-bezier(.16,1,.3,1),transform .3s cubic-bezier(.16,1,.3,1),visibility 0s linear .3s;}
.nav-has-dropdown:hover .nav-dropdown{visibility:visible;opacity:1;pointer-events:auto;transform:translateY(0) scale(1);transition:opacity .35s cubic-bezier(.16,1,.3,1),transform .35s cubic-bezier(.16,1,.3,1),visibility 0s linear 0s;}
.nav-dd-inner{display:flex;align-items:stretch;}.nav-dd-left{width:250px;flex-shrink:0;padding:8px;border-right:1px solid var(--border);}
.nav-dd-right-outer{width:0;overflow:hidden;transition:width .28s cubic-bezier(.4,0,.2,1);flex-shrink:0;}.nav-dd-right-outer.dd-show{width:264px;}.nav-dd-right{width:264px;padding:8px;position:relative;min-height:220px;opacity:0;transition:opacity .18s ease .12s;}.nav-dd-right-outer.dd-show .nav-dd-right{opacity:1;}
.nav-dd-item{display:flex;align-items:center;justify-content:space-between;padding:9px 14px;font-size:13px;color:var(--muted);text-decoration:none;border-radius:8px;transition:all .15s;}.nav-dd-item:hover,.nav-dd-item.dd-active{background:var(--teal-lt);color:var(--teal);}
.dd-chevron{font-size:12px;opacity:0.4;flex-shrink:0;margin-left:6px;}
.nav-dd-sub{position:absolute;top:0;left:0;right:0;display:flex;flex-direction:column;gap:1px;opacity:0;pointer-events:none;transition:opacity .15s ease;}.nav-dd-sub.dd-active{opacity:1;pointer-events:auto;}
.nav-dd-sub a{display:block;padding:8px 12px;font-size:12.5px;color:var(--muted);text-decoration:none;border-radius:8px;transition:all .15s;}.nav-dd-sub a:hover{background:var(--teal-lt);color:var(--teal);}
.dd-view-all{font-weight:700;font-size:11px;color:var(--teal) !important;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:2px;}
.hamburger{display:none;flex-direction:column;gap:5px;background:none;border:none;cursor:pointer;padding:11px 8px;margin-left:4px;min-width:44px;min-height:44px;align-items:center;justify-content:center;}.hamburger span{display:block;width:22px;height:2px;background:var(--text);border-radius:2px;transition:all .25s;}
.hamburger.open span:nth-child(1){transform:rotate(45deg) translate(5px,5px);}.hamburger.open span:nth-child(2){opacity:0;}.hamburger.open span:nth-child(3){transform:rotate(-45deg) translate(5px,-5px);}
.mobile-menu{display:flex;flex-direction:column;gap:0;position:fixed;top:0;right:0;bottom:0;width:300px;max-width:85vw;z-index:9100;background:var(--bg);padding:72px 24px 40px;transform:translateX(110%);transition:transform .38s cubic-bezier(.16,1,.3,1);box-shadow:-16px 0 56px rgba(0,0,0,0.18);overflow-y:auto;border-left:1px solid var(--border);}.nx-mob-bd{display:none;position:fixed;inset:0;z-index:9050;background:rgba(15,43,76,0.4);backdrop-filter:blur(3px);}.nx-mob-bd.open{display:block;}.nx-mob-close{position:absolute;top:18px;right:18px;background:rgba(0,0,0,0.06);border:none;cursor:pointer;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--text);font-size:20px;line-height:1;z-index:1;}
.mobile-menu.open{transform:translateX(0);}.mobile-menu a{font-size:15px;font-weight:500;color:var(--muted);text-decoration:none;padding:13px 0;border-bottom:1px solid var(--border);}
.mobile-svc-wrap{border-bottom:1px solid var(--border);}.mobile-svc-toggle{width:100%;background:none;border:none;text-align:left;font-size:15px;font-weight:500;color:var(--muted);padding:13px 0;cursor:pointer;display:flex;justify-content:space-between;align-items:center;}.mobile-svc-arrow{font-size:18px;transition:transform .2s;}.mobile-svc-wrap.open .mobile-svc-arrow{transform:rotate(90deg);}.mobile-svc-list{display:none;flex-direction:column;padding:0 0 8px 16px;}.mobile-svc-wrap.open .mobile-svc-list{display:flex;}.mobile-svc-list a{font-size:14px;color:var(--muted);text-decoration:none;padding:9px 0;border-bottom:1px solid var(--border);}
button.mobile-cta{margin-top:12px;padding:13px;background:var(--teal);color:#fff;font-weight:700;text-align:center;border-radius:10px;border:none;font-size:14px;cursor:pointer;font-family:inherit;}
.page-hero{padding:calc(var(--nav-h)+72px) 44px 64px;background:linear-gradient(135deg,var(--navy) 0%,#0a3d36 100%);color:#fff;position:relative;overflow:hidden;}
.page-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 55% at 50% -10%,rgba(13,148,136,0.3),transparent);pointer-events:none;}
.hero-inner{max-width:860px;margin:0 auto;position:relative;z-index:1;}
.hero-label{font-size:10px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;color:rgba(68,202,162,0.8);margin-bottom:14px;}
.page-hero h1{font-size:clamp(1.8rem,3.5vw,2.8rem);font-weight:800;letter-spacing:-0.5px;line-height:1.15;margin-bottom:14px;}
.page-hero p{font-size:16px;color:rgba(255,255,255,0.7);line-height:1.7;max-width:640px;margin-bottom:28px;}
.btn-primary{padding:13px 26px;background:var(--teal);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block;transition:all .15s;font-family:inherit;}
.btn-primary:hover{filter:brightness(1.1);transform:translateY(-1px);}
.btn-ghost{padding:12px 24px;background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,0.3);border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;transition:all .15s;}
.btn-ghost:hover{border-color:rgba(255,255,255,0.7);}
section{padding:64px 44px;}.section-alt{padding:64px 44px;background:var(--bg-surface);}
.container{max-width:1060px;margin:0 auto;}
.sec-label{font-size:10px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;color:var(--teal);margin-bottom:10px;}
h2{font-size:clamp(1.5rem,2.8vw,2rem);font-weight:800;letter-spacing:-0.5px;color:var(--text);margin-bottom:12px;line-height:1.2;}
.lead{font-size:16px;color:var(--muted);line-height:1.75;margin-bottom:20px;}
.breadcrumb{font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:16px;}
.breadcrumb a{color:rgba(255,255,255,0.65);text-decoration:none;}.breadcrumb a:hover{color:#fff;}
.breadcrumb span{margin:0 6px;opacity:0.4;}
.state-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:24px;}
.state-card{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px;text-decoration:none;color:var(--text);transition:all .18s;display:block;}
.state-card:hover{border-color:var(--teal);color:var(--teal);transform:translateY(-1px);box-shadow:0 4px 16px rgba(13,148,136,0.1);}
.state-card .st-abbr{font-size:10px;font-weight:800;letter-spacing:1.5px;color:var(--teal);text-transform:uppercase;margin-bottom:3px;}
.state-card .st-name{font-size:13px;font-weight:600;}
.county-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:24px;}
.county-card{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:16px 18px;text-decoration:none;color:var(--text);transition:all .18s;display:block;}
.county-card:hover{border-color:var(--teal);color:var(--teal);transform:translateY(-1px);box-shadow:0 4px 16px rgba(13,148,136,0.1);}
.county-card .cn-name{font-size:14px;font-weight:700;margin-bottom:4px;}
.county-card .cn-count{font-size:11px;color:var(--dim);}
.city-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:20px;}
.city-item{background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:12px 14px;font-size:13.5px;font-weight:500;color:var(--muted);}
.service-links{display:flex;gap:12px;flex-wrap:wrap;margin-top:20px;}
.svc-link{padding:10px 18px;border:1.5px solid var(--teal);border-radius:8px;color:var(--teal);text-decoration:none;font-size:13px;font-weight:600;transition:all .15s;}
.svc-link:hover{background:var(--teal);color:#fff;}
.cta-block{background:linear-gradient(135deg,var(--navy),#0a3d36);border-radius:20px;padding:56px 48px;text-align:center;position:relative;overflow:hidden;}
.cta-block::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 55% at 50% -10%,rgba(13,148,136,0.25),transparent);}
.cta-block h2{color:#FAF8F5;margin-bottom:10px;position:relative;}
.cta-block p{color:rgba(250,248,245,0.65);font-size:15px;margin-bottom:24px;position:relative;}
footer{background:var(--navy);padding:56px 44px 32px;color:rgba(250,248,245,0.65);}
.footer-inner{max-width:1160px;margin:0 auto;}
.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px;margin-bottom:40px;}
.footer-col-title{font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:rgba(250,248,245,0.3);margin-bottom:14px;}
.footer-links{display:flex;flex-direction:column;gap:8px;}.footer-links a{font-size:13px;color:rgba(250,248,245,0.5);text-decoration:none;transition:color .15s;}.footer-links a:hover{color:#FAF8F5;}
.footer-bottom{border-top:1px solid rgba(255,255,255,0.08);padding-top:20px;font-size:12px;color:rgba(250,248,245,0.3);text-align:center;}
@media(max-width:900px){.state-grid{grid-template-columns:repeat(4,1fr);}.county-grid{grid-template-columns:repeat(2,1fr);}.city-grid{grid-template-columns:repeat(2,1fr);}.footer-grid{grid-template-columns:1fr 1fr;gap:32px;}}
@media(max-width:768px){:root{--nav-h:56px;}nav{padding:0 20px;}.nav-links{display:none;}.nav-cta{display:none;}.hamburger{display:flex;}section,.section-alt{padding:44px 20px;}.page-hero{padding:calc(var(--nav-h)+48px) 20px 44px;}.state-grid{grid-template-columns:repeat(2,1fr);}.county-grid{grid-template-columns:1fr;}.city-grid{grid-template-columns:1fr;}.cta-block{padding:36px 20px;}.footer-grid{grid-template-columns:1fr;gap:24px;}footer{padding:36px 20px 24px;}}'''

GA = '<script async src="https://www.googletagmanager.com/gtag/js?id=G-TY0PZHVN0L"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","G-TY0PZHVN0L");</script>'

def head(title, desc, canonical, og_img='https://nexvorasystems.us/assets/logo-dark.png'):
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
{GA}
<title>{title}</title>
<meta name="description" content="{desc}"/>
<link rel="canonical" href="https://nexvorasystems.us{canonical}"/>
<meta property="og:title" content="{title}"/>
<meta property="og:description" content="{desc}"/>
<meta property="og:url" content="https://nexvorasystems.us{canonical}"/>
<meta property="og:image" content="{og_img}"/>
<meta property="og:type" content="website"/>
<link rel="icon" href="/assets/logo-dark.png" type="image/png"/>
<style>{CSS}</style>
</head>
<body>
{NAV}'''

def scripts():
    return f'''<script src="/assets/js/discovery-modal.js" defer></script>
<script>{HAMBURGER_JS}</script>
</body></html>'''

def cta_section():
    return '''<section><div class="container">
  <div class="cta-block">
    <h2>Ready to Fix What's Holding Your Business Back?</h2>
    <p>Book a free 30-minute discovery call. We'll identify your top 3 operational bottlenecks — no pitch, no pressure.</p>
    <button class="btn-primary" data-discovery-trigger style="position:relative;">Book My Free Discovery Call</button>
  </div>
</div></section>'''

# ── Hub Page ──────────────────────────────────────────────────────────────────
def gen_hub():
    state_cards = '\n'.join(
        f'<a href="/service-areas/{s["slug"]}" class="state-card"><div class="st-abbr">{s["abbr"]}</div><div class="st-name">{s["state"]}</div></a>'
        for s in LOCATIONS
    )
    schema = json.dumps({
        "@context":"https://schema.org",
        "@type":"ItemList",
        "name":"Nexvora Systems Service Areas — All 50 States",
        "description":"Business operations consulting and AI automation services available across all 50 US states.",
        "url":"https://nexvorasystems.us/service-areas",
        "numberOfItems": len(LOCATIONS),
        "itemListElement":[{"@type":"ListItem","position":i+1,"name":s["state"]+" Business Consulting","url":f"https://nexvorasystems.us/service-areas/{s['slug']}"} for i,s in enumerate(LOCATIONS)]
    }, indent=None)
    html = head(
        "Business Consulting Service Areas — All 50 States | Nexvora Systems",
        "Nexvora Systems provides operations consulting and AI automation to small businesses across all 50 US states. Find your state to see local services, counties, and cities we serve.",
        "/service-areas"
    )
    html += f'''<script type="application/ld+json">{schema}</script>
<div class="page-hero">
  <div class="hero-inner">
    <div class="breadcrumb"><a href="/">Home</a><span>›</span>Service Areas</div>
    <div class="hero-label">Nexvora Systems — Nationwide Coverage</div>
    <h1>Business Consulting Across All 50 States</h1>
    <p>We help service businesses improve operations, automate workflows, and grow revenue — no matter where you are. Click your state to explore local services and counties we serve.</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap;"><button class="btn-primary" data-discovery-trigger>Book a Free Discovery Call</button><a href="/services" class="btn-ghost">View All Services</a></div>
  </div>
</div>
<section><div class="container">
  <div class="sec-label">All 50 States</div>
  <h2>Select Your State</h2>
  <p class="lead">We serve businesses of all sizes across every US state. Select your state below to see the counties and cities we serve, along with state-specific service pages.</p>
  <div class="state-grid">{state_cards}</div>
</div></section>
<section class="section-alt"><div class="container">
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;">
    <div><div class="sec-label">Operations</div><h3 style="font-size:16px;font-weight:700;margin-bottom:8px;">Business Systems & Process</h3><p style="font-size:14px;color:var(--muted);line-height:1.7;">SOPs, sales systems, team structures, financial clarity, and growth planning for service businesses nationwide.</p><a href="/services/operations-business-systems" style="font-size:13px;color:var(--teal);font-weight:600;text-decoration:none;">Learn more →</a></div>
    <div><div class="sec-label">AI Automation</div><h3 style="font-size:16px;font-weight:700;margin-bottom:8px;">Workflow & AI Integration</h3><p style="font-size:14px;color:var(--muted);line-height:1.7;">Automate repetitive tasks, deploy AI chatbots, integrate your CRM, and build real-time reporting dashboards.</p><a href="/services/ai-automation" style="font-size:13px;color:var(--teal);font-weight:600;text-decoration:none;">Learn more →</a></div>
    <div><div class="sec-label">Results</div><h3 style="font-size:16px;font-weight:700;margin-bottom:8px;">30-Day First Results</h3><p style="font-size:14px;color:var(--muted);line-height:1.7;">Most clients see measurable improvements in operational efficiency within 30 days of engagement start.</p><a href="/contact" style="font-size:13px;color:var(--teal);font-weight:600;text-decoration:none;">Get started →</a></div>
  </div>
</div></section>
{cta_section()}
{FOOTER}
{scripts()}'''
    return html

# ── State Page ────────────────────────────────────────────────────────────────
def gen_state(s):
    county_cards = '\n'.join(
        f'<a href="/service-areas/{s["slug"]}/{c["slug"]}" class="county-card"><div class="cn-name">{c["name"]}</div><div class="cn-count">{len(c["cities"])} cities served</div></a>'
        for c in s['counties']
    )
    schema = json.dumps({
        "@context":"https://schema.org",
        "@graph":[
            {"@type":"ProfessionalService","name":"Nexvora Systems","url":"https://nexvorasystems.us","telephone":"+18136676464","address":{"@type":"PostalAddress","streetAddress":"7901 4th St N","addressLocality":"St. Petersburg","addressRegion":"FL","postalCode":"33702","addressCountry":"US"},"areaServed":{"@type":"State","name":s['state']}},
            {"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://nexvorasystems.us"},{"@type":"ListItem","position":2,"name":"Service Areas","item":"https://nexvorasystems.us/service-areas"},{"@type":"ListItem","position":3,"name":s['state'],"item":f"https://nexvorasystems.us/service-areas/{s['slug']}"}]}
        ]
    }, indent=None)
    html = head(
        f"Business Consulting in {s['state']} — Counties & Cities | Nexvora Systems",
        f"Nexvora Systems serves businesses across {s['state']}. Explore {len(s['counties'])} counties and their cities for operations consulting, AI automation, and business growth services.",
        f"/service-areas/{s['slug']}"
    )
    html += f'''<script type="application/ld+json">{schema}</script>
<div class="page-hero">
  <div class="hero-inner">
    <div class="breadcrumb"><a href="/">Home</a><span>›</span><a href="/service-areas">Service Areas</a><span>›</span>{s["state"]}</div>
    <div class="hero-label">Service Areas — {s["state"]}</div>
    <h1>Business Consulting in {s["state"]}</h1>
    <p>We help {s["state"]} service businesses build stronger operations, automate workflows, and scale sustainably. Explore our service coverage by county below.</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap;"><button class="btn-primary" data-discovery-trigger>Book a Free Discovery Call</button><a href="/services/operations-{s["slug"]}" class="btn-ghost">View {s["state"]} Operations Page</a></div>
  </div>
</div>
<section><div class="container">
  <div class="sec-label">Coverage by County</div>
  <h2>{s["state"]} Counties We Serve</h2>
  <p class="lead">Click any county below to see the specific cities and communities we serve in that area, along with relevant local business insights.</p>
  <div class="county-grid">{county_cards}</div>
</div></section>
<section class="section-alt"><div class="container">
  <div class="sec-label">Services in {s["state"]}</div>
  <h2>What We Do for {s["state"]} Businesses</h2>
  <p class="lead">Whether you're in a major metro or a smaller market, Nexvora Systems delivers the same high-impact consulting that drives measurable results for service businesses across {s["state"]}.</p>
  <div class="service-links">
    <a href="/services/operations-{s["slug"]}" class="svc-link">Operations Consulting — {s["state"]}</a>
    <a href="/services/ai-automation-{s["slug"]}" class="svc-link">AI Automation — {s["state"]}</a>
    <a href="/services/operations-business-systems" class="svc-link">View Full Operations Service</a>
    <a href="/services/ai-automation" class="svc-link">View Full AI Service</a>
  </div>
</div></section>
{cta_section()}
{FOOTER}
{scripts()}'''
    return html

# ── County Page ───────────────────────────────────────────────────────────────
def gen_county(s, c):
    city_items = '\n'.join(f'<div class="city-item">{city}</div>' for city in c['cities'])
    schema = json.dumps({
        "@context":"https://schema.org",
        "@graph":[
            {"@type":"ProfessionalService","name":"Nexvora Systems","url":"https://nexvorasystems.us","telephone":"+18136676464","address":{"@type":"PostalAddress","streetAddress":"7901 4th St N","addressLocality":"St. Petersburg","addressRegion":"FL","postalCode":"33702","addressCountry":"US"},"areaServed":{"@type":"AdministrativeArea","name":c['name']+", "+s['state']}},
            {"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://nexvorasystems.us"},{"@type":"ListItem","position":2,"name":"Service Areas","item":"https://nexvorasystems.us/service-areas"},{"@type":"ListItem","position":3,"name":s['state'],"item":f"https://nexvorasystems.us/service-areas/{s['slug']}"},{"@type":"ListItem","position":4,"name":c['name'],"item":f"https://nexvorasystems.us/service-areas/{s['slug']}/{c['slug']}"}]}
        ]
    }, indent=None)
    html = head(
        f"Business Consulting in {c['name']}, {s['state']} | Nexvora Systems",
        f"Nexvora Systems serves businesses in {c['name']}, {s['state']}. Operations consulting, AI automation, and business growth services for {', '.join(c['cities'][:4])} and surrounding communities.",
        f"/service-areas/{s['slug']}/{c['slug']}"
    )
    html += f'''<script type="application/ld+json">{schema}</script>
<div class="page-hero">
  <div class="hero-inner">
    <div class="breadcrumb"><a href="/">Home</a><span>›</span><a href="/service-areas">Service Areas</a><span>›</span><a href="/service-areas/{s["slug"]}">{s["state"]}</a><span>›</span>{c["name"]}</div>
    <div class="hero-label">Service Area — {c["name"]}, {s["state"]}</div>
    <h1>Business Consulting in {c["name"]}, {s["abbr"]}</h1>
    <p>We help small and growing businesses in {c["name"]} streamline operations, automate workflows, and achieve sustainable growth. Serving {", ".join(c["cities"][:5])} and all surrounding communities.</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap;"><button class="btn-primary" data-discovery-trigger>Book a Free Discovery Call</button><a href="/service-areas/{s["slug"]}" class="btn-ghost">Back to {s["state"]}</a></div>
  </div>
</div>
<section><div class="container">
  <div class="sec-label">Cities &amp; Communities</div>
  <h2>Cities We Serve in {c["name"]}</h2>
  <p class="lead">Our consultants serve businesses throughout {c["name"]}, {s["state"]}, including the following cities and communities. Remote and on-site engagements available.</p>
  <div class="city-grid">{city_items}</div>
</div></section>
<section class="section-alt"><div class="container">
  <div class="sec-label">Services Available</div>
  <h2>How We Help {c["name"]} Businesses</h2>
  <p class="lead">Service businesses in {c["name"]} face the same challenges as companies everywhere — owner dependency, inconsistent processes, and manual work that should be automated. We fix all of it.</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px;">
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:20px;"><strong style="display:block;margin-bottom:8px;font-size:14px;">Operations &amp; Business Systems</strong><p style="font-size:13px;color:var(--muted);margin:0;line-height:1.65;">SOPs, sales systems, team structures, financial clarity, and 12-month growth plans tailored to your business.</p></div>
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:20px;"><strong style="display:block;margin-bottom:8px;font-size:14px;">AI Automation &amp; Workflows</strong><p style="font-size:13px;color:var(--muted);margin:0;line-height:1.65;">Automate your follow-ups, reporting, client onboarding, and day-to-day tasks using AI-powered tools.</p></div>
  </div>
  <div class="service-links" style="margin-top:16px;">
    <a href="/services/operations-{s["slug"]}" class="svc-link">Operations Consulting — {s["state"]}</a>
    <a href="/services/ai-automation-{s["slug"]}" class="svc-link">AI Automation — {s["state"]}</a>
  </div>
</div></section>
{cta_section()}
{FOOTER}
{scripts()}'''
    return html

# ── Generate ──────────────────────────────────────────────────────────────────
with open('service-areas/index.html', 'w') as f:
    f.write(gen_hub())
print('Hub page: service-areas/index.html')

for s in LOCATIONS:
    sdir = f'service-areas/{s["slug"]}'
    os.makedirs(sdir, exist_ok=True)
    with open(f'service-areas/{s["slug"]}.html', 'w') as f:
        f.write(gen_state(s))
    county_count = 0
    for c in s['counties']:
        with open(f'{sdir}/{c["slug"]}.html', 'w') as f:
            f.write(gen_county(s, c))
        county_count += 1
    print(f'  {s["state"]}: 1 state page + {county_count} county pages')

total_counties = sum(len(s['counties']) for s in LOCATIONS)
print(f'\nDone. 1 hub + 50 state pages + {total_counties} county pages = {1+50+total_counties} total pages.')
