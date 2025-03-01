/**
 * External dependencies
 */
import config from 'config';

/**
 * Internal dependencies
 */
import PressableLogonPage from '../lib/pages/pressable/pressable-logon-page';
import PressableSitesPage from '../lib/pages/pressable/pressable-sites-page';
import PressableApprovePage from '../lib/pages/pressable/pressable-approve-page';
import PressableSiteSettingsPage from '../lib/pages/pressable/pressable-site-settings-page';
import JetpackAuthorizePage from '../lib/pages/jetpack-authorize-page';
import * as driverManager from '../lib/driver-manager';
import * as dataHelper from '../lib/data-helper';
import PressableNUXFlow from '../lib/flows/pressable-nux-flow';
import ReaderPage from '../lib/pages/reader-page';
import SidebarComponent from '../lib/components/sidebar-component';
import NavBarComponent from '../lib/components/nav-bar-component';
import LoginFlow from '../lib/flows/login-flow';

const mochaTimeOut = config.get( 'mochaTimeoutMS' );
const startBrowserTimeoutMS = config.get( 'startBrowserTimeoutMS' );
const screenSize = driverManager.currentScreenSize();
const host = dataHelper.getJetpackHost();

// Disabled due to p1535659602000200-slack-e2e-testing-discuss
// tl;dr: There is a bug in my.pressable.com which cause some noise/warnings/errors
// We shouldn't create new Pressable sites for every test.
// eslint-disable-next-line no-constant-condition
describe.skip( `[${ host }] Pressable NUX: (${ screenSize })`, function () {
	this.timeout( mochaTimeOut * 2 );
	let driver;
	before( async function () {
		this.timeout( startBrowserTimeoutMS );
		driver = await driverManager.startBrowser();
	} );

	describe( 'Connect via Pressable @parallel @jetpack', function () {
		before( async function () {
			return await driverManager.ensureNotLoggedIn( driver );
		} );

		it( 'Can log into WordPress.com', async function () {
			return await new LoginFlow( driver, 'jetpackUser' + host ).login();
		} );

		it( 'Can log into Pressable', async function () {
			const pressableLogonPage = await PressableLogonPage.Visit( driver );
			return await pressableLogonPage.loginWithWP();
		} );

		it( 'Can approve login with WordPress', async function () {
			const pressableApprovePage = await PressableApprovePage.Expect( driver );
			return await pressableApprovePage.approve();
		} );

		it( 'Can create new site', async function () {
			this.siteName = dataHelper.getNewBlogName();
			this.pressableSitesPage = await PressableSitesPage.Expect( driver );
			return await this.pressableSitesPage.addNewSite( this.siteName );
		} );

		it( 'Can go to site settings', async function () {
			return await this.pressableSitesPage.gotoSettings( this.siteName );
		} );

		it( 'Can proceed to Jetpack activation', async function () {
			const siteSettings = await PressableSiteSettingsPage.Expect( driver );
			await siteSettings.waitForJetpackPremium();
			return await siteSettings.activateJetpackPremium();
		} );

		it( 'Can approve connection on the authorization page', async function () {
			const jetpackAuthorizePage = await JetpackAuthorizePage.Expect( driver );
			return await jetpackAuthorizePage.approveConnection();
		} );

		it( 'Can wait for 30 sec until Jetpack Rewind will be ready for configuration', function () {
			return driver.sleep( 30000 );
		} );

		it( 'Can proceed with Pressable NUX flow', async function () {
			return await new PressableNUXFlow( driver ).addSiteCredentials();
		} );

		it( 'Can open Rewind activity page', async function () {
			await ReaderPage.Visit( driver );
			const navBarComponent = await NavBarComponent.Expect( driver );
			await navBarComponent.clickMySites();
			const sidebarComponent = await SidebarComponent.Expect( driver );
			await sidebarComponent.selectSiteSwitcher();
			await sidebarComponent.searchForSite( this.siteName );
			await sidebarComponent.selectActivity();
		} );

		// Disabled due to to longer time is required to make a backup.
		// it( 'Can wait until Rewind backup is completed', function() {
		// 	const activityPage = new ActivityPage( driver );
		// 	return activityPage.waitUntilBackupCompleted();
		// } );

		after( async function () {
			const pressableSitesPage = await PressableSitesPage.Visit( driver );
			return await pressableSitesPage.deleteFirstSite();
		} );
	} );
} );
