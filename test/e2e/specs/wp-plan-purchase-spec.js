/**
 * External dependencies
 */
import config from 'config';
import assert from 'assert';

/**
 * Internal dependencies
 */
import * as driverManager from '../lib/driver-manager.js';
import * as dataHelper from '../lib/data-helper';

import LoginFlow from '../lib/flows/login-flow.js';
import PlansPage from '../lib/pages/plans-page.js';
import SidebarComponent from '../lib/components/sidebar-component.js';
import SecurePaymentComponent from '../lib/components/secure-payment-component';
import NavBarComponent from '../lib/components/nav-bar-component';
import ProfilePage from '../lib/pages/profile-page';
import PurchasesPage from '../lib/pages/purchases-page';
import ManagePurchasePage from '../lib/pages/manage-purchase-page';

const mochaTimeOut = config.get( 'mochaTimeoutMS' );
const startBrowserTimeoutMS = config.get( 'startBrowserTimeoutMS' );
const screenSize = driverManager.currentScreenSize();
const host = dataHelper.getJetpackHost();

describe( `[${ host }] Plans: (${ screenSize })`, function () {
	this.timeout( mochaTimeOut );
	let driver;

	before( 'Start browser', async function () {
		this.timeout( startBrowserTimeoutMS );
		driver = await driverManager.startBrowser();
	} );

	describe( 'Comparing Plans:  @parallel @jetpack', function () {
		it( 'Login and Select My Site', async function () {
			const loginFlow = new LoginFlow( driver );
			return await loginFlow.loginAndSelectMySite();
		} );

		it( 'Can Select Plans', async function () {
			const sideBarComponent = await SidebarComponent.Expect( driver );
			return await sideBarComponent.selectPlans();
		} );

		it( 'Can Compare Plans', async function () {
			const plansPage = await PlansPage.Expect( driver );
			await plansPage.openPlansTab();
			return await plansPage.waitForComparison();
		} );

		if ( host === 'WPCOM' ) {
			it( 'Can Verify Current Plan', async function () {
				const planName = 'premium';
				const plansPage = await PlansPage.Expect( driver );
				const present = await plansPage.confirmCurrentPlan( planName );
				return assert( present, `Failed to detect correct plan (${ planName })` );
			} );

			it( 'Can See Exactly One Primary CTA Button', async function () {
				const plansPage = await PlansPage.Expect( driver );
				return assert(
					await plansPage.onePrimaryButtonShown(),
					'Incorrect number of primary buttons'
				);
			} );
		} else {
			it( 'Can Verify Current Plan', async function () {
				// Jetpack
				const plansPage = await PlansPage.Expect( driver );
				const displayed = await plansPage.planTypesShown( 'jetpack' );
				return assert( displayed, 'The Jetpack plans are NOT displayed' );
			} );
		}
	} );

	describe( 'Viewing a specific plan with coupon: @parallel @jetpack', function () {
		let originalCartAmount;
		let loginFlow;

		before( async function () {
			return await driverManager.ensureNotLoggedIn( driver );
		} );

		it( 'Login and Select My Site', async function () {
			loginFlow = new LoginFlow( driver );
			return await loginFlow.loginAndSelectMySite();
		} );

		it( 'Can Select Plans', async function () {
			const sideBarComponent = await SidebarComponent.Expect( driver );
			return await sideBarComponent.selectPlans();
		} );

		it( 'Can Compare Plans', async function () {
			const plansPage = await PlansPage.Expect( driver );
			await plansPage.openPlansTab();
			if ( host === 'WPCOM' ) {
				await plansPage.openAdvancedPlansSegment();
			}
			return await plansPage.waitForComparison();
		} );

		it( 'Select Business Plan', async function () {
			const plansPage = await PlansPage.Expect( driver );
			return await plansPage.selectPaidPlan();
		} );

		it( 'Remove any existing coupon', async function () {
			const securePaymentComponent = await SecurePaymentComponent.Expect( driver );

			if ( await securePaymentComponent.hasCouponApplied() ) {
				await securePaymentComponent.removeCoupon();
			}
		} );

		it( 'Can Correctly Apply Coupon', async function () {
			const securePaymentComponent = await SecurePaymentComponent.Expect( driver );

			await securePaymentComponent.toggleCartSummary();
			originalCartAmount = await securePaymentComponent.cartTotalAmount();

			await securePaymentComponent.enterCouponCode( dataHelper.getTestCouponCode() );

			const newCartAmount = await securePaymentComponent.cartTotalAmount();
			const expectedCartAmount =
				Math.round( ( originalCartAmount * 0.99 + Number.EPSILON ) * 100 ) / 100;

			assert.strictEqual( newCartAmount, expectedCartAmount, 'Coupon not applied properly' );
		} );

		it( 'Can Remove Coupon', async function () {
			const securePaymentComponent = await SecurePaymentComponent.Expect( driver );

			await securePaymentComponent.removeCoupon();

			const removedCouponAmount = await securePaymentComponent.cartTotalAmount();
			assert.strictEqual( removedCouponAmount, originalCartAmount, 'Coupon not removed properly' );
		} );

		it( 'Remove from cart', async function () {
			const securePaymentComponent = await SecurePaymentComponent.Expect( driver );

			return await securePaymentComponent.removeBusinessPlan();
		} );
	} );

	describe( 'Renew a plan:  @parallel', function () {
		before( async function () {
			return await driverManager.ensureNotLoggedIn( driver );
		} );

		it( 'Can log into WordPress.com', async function () {
			const loginFlow = new LoginFlow( driver );
			return await loginFlow.login();
		} );

		it( 'Can navigate to purchases', async function () {
			const navBarComponent = await NavBarComponent.Expect( driver );
			await navBarComponent.clickProfileLink();
			const profilePage = await ProfilePage.Expect( driver );
			await profilePage.chooseManagePurchases();
			const purchasesPage = await PurchasesPage.Expect( driver );
			await purchasesPage.dismissGuidedTour();
			return await purchasesPage.selectPremiumPlanOnConnectedSite();
		} );

		it( '"Renew Now" link takes user to Payment Details form', async function () {
			const managePurchasePage = await ManagePurchasePage.Expect( driver );
			await managePurchasePage.chooseRenewNow();
			const securePaymentComponent = await SecurePaymentComponent.Expect( driver );
			const premiumPlanInCart = await securePaymentComponent.containsPremiumPlan();
			return assert.strictEqual(
				premiumPlanInCart,
				true,
				"The cart doesn't contain the premium plan"
			);
		} );
	} );

	describe( 'Upgrade a plan:  @parallel @jetpack', function () {
		before( async function () {
			return await driverManager.ensureNotLoggedIn( driver );
		} );

		it( 'Can log into WordPress.com', async function () {
			const loginFlow = new LoginFlow( driver );
			return await loginFlow.loginAndSelectMySite();
		} );

		it( 'Can navigate to plans page and select business plan', async function () {
			const sidebarComponent = await SidebarComponent.Expect( driver );
			await sidebarComponent.selectPlans();
			const plansPage = await PlansPage.Expect( driver );
			await plansPage.openPlansTab();
			return await plansPage.selectPaidPlan();
		} );

		it( 'User is taken to be Payment Details form', async function () {
			const securePaymentComponent = await SecurePaymentComponent.Expect( driver );
			const businessPlanInCart = await securePaymentComponent.containsBusinessPlan();
			return assert.strictEqual(
				businessPlanInCart,
				true,
				"The cart doesn't contain the business plan"
			);
		} );
	} );
} );
