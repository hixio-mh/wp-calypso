/**
 * External dependencies
 */

import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { intersection } from 'lodash';
import classNames from 'classnames';
import { localize } from 'i18n-calypso';
import { parse as parseQs } from 'qs';
import { Button } from '@automattic/components';

/**
 * Internal dependencies
 */
import { getTld, isSubdomain } from 'calypso/lib/domains';
import { getSiteBySlug } from 'calypso/state/sites/selectors';
import StepWrapper from 'calypso/signup/step-wrapper';
import PlansFeaturesMain from 'calypso/my-sites/plans-features-main';
import GutenboardingHeader from 'calypso/my-sites/plans-features-main/gutenboarding-header';
import QueryPlans from 'calypso/components/data/query-plans';
import { planHasFeature, FEATURE_UPLOAD_THEMES_PLUGINS } from '@automattic/calypso-products';
import { getSiteGoals } from 'calypso/state/signup/steps/site-goals/selectors';
import { getSiteType } from 'calypso/state/signup/steps/site-type/selectors';
import { getSiteTypePropertyValue } from 'calypso/lib/signup/site-type';
import { saveSignupStep, submitSignupStep } from 'calypso/state/signup/progress/actions';
import { recordTracksEvent } from 'calypso/state/analytics/actions';
import hasInitializedSites from 'calypso/state/selectors/has-initialized-sites';
import { getUrlParts } from '@automattic/calypso-url';
import { isTreatmentPlansReorderTest } from 'calypso/state/marketing/selectors';

/**
 * Style dependencies
 */
import './style.scss';
import PulsingDot from 'calypso/components/pulsing-dot';
import { isTabletResolution, isDesktop } from '@automattic/viewport';

export class PlansStep extends Component {
	state = {
		isDesktop: ! isTabletResolution(),
	};

	windowResize = () => {
		this.setState( { plansWithScroll: ! isTabletResolution() } );
	};

	componentWillUnmount() {
		if ( typeof window === 'object' ) {
			window.removeEventListener( 'resize', this.windowResize );
		}
	}

	componentDidMount() {
		if ( typeof window === 'object' ) {
			window.addEventListener( 'resize', this.windowResize );
		}
		this.props.saveSignupStep( { stepName: this.props.stepName } );
	}

	onSelectPlan = ( cartItem ) => {
		const { additionalStepData, stepSectionName, stepName, flowName } = this.props;

		if ( cartItem ) {
			this.props.recordTracksEvent( 'calypso_signup_plan_select', {
				product_slug: cartItem.product_slug,
				free_trial: cartItem.free_trial,
				from_section: stepSectionName ? stepSectionName : 'default',
			} );

			// If we're inside the store signup flow and the cart item is a Business or eCommerce Plan,
			// set a flag on it. It will trigger Automated Transfer when the product is being
			// activated at the end of the checkout process.
			if (
				flowName === 'ecommerce' &&
				planHasFeature( cartItem.product_slug, FEATURE_UPLOAD_THEMES_PLUGINS )
			) {
				cartItem.extra = Object.assign( cartItem.extra || {}, {
					is_store_signup: true,
				} );
			}
		} else {
			this.props.recordTracksEvent( 'calypso_signup_free_plan_select', {
				from_section: stepSectionName ? stepSectionName : 'default',
			} );
		}

		const step = {
			stepName,
			stepSectionName,
			cartItem,
			...additionalStepData,
		};

		this.props.submitSignupStep( step, {
			cartItem,
		} );
		this.props.goToNextStep();
	};

	getDomainName() {
		return (
			this.props.signupDependencies.domainItem && this.props.signupDependencies.domainItem.meta
		);
	}

	getCustomerType() {
		if ( this.props.customerType ) {
			return this.props.customerType;
		}

		const siteGoals = this.props.siteGoals.split( ',' );
		const customerType =
			getSiteTypePropertyValue( 'slug', this.props.siteType, 'customerType' ) ||
			( intersection( siteGoals, [ 'sell', 'promote' ] ).length > 0 ? 'business' : 'personal' );

		return customerType;
	}

	handleFreePlanButtonClick = () => {
		this.onSelectPlan( null ); // onUpgradeClick expects a cart item -- null means Free Plan.
	};

	getGutenboardingHeader() {
		// launch flow coming from Gutenboarding
		if ( this.props.flowName === 'new-launch' ) {
			const { headerText, subHeaderText } = this.props;

			return (
				<GutenboardingHeader
					headerText={ headerText }
					subHeaderText={ subHeaderText }
					onFreePlanSelect={ this.handleFreePlanButtonClick }
				/>
			);
		}

		return null;
	}

	getIntervalType() {
		const urlParts = getUrlParts( typeof window !== 'undefined' ? window.location?.href : '' );
		const intervalType = urlParts?.searchParams.get( 'intervalType' );

		if ( [ 'yearly', 'monthly' ].includes( intervalType ) ) {
			return intervalType;
		}

		// Default value
		return 'yearly';
	}

	plansFeaturesList() {
		const {
			disableBloggerPlanWithNonBlogDomain,
			hideFreePlan,
			isLaunchPage,
			selectedSite,
			planTypes,
			flowName,
			showTreatmentPlansReorderTest,
			isLoadingExperiment,
			isInVerticalScrollingPlansExperiment,
			isReskinned,
		} = this.props;

		return (
			<div>
				<QueryPlans />
				{ isLoadingExperiment ? (
					<div className="plans__loading-container">
						<PulsingDot delay={ 400 } active />
					</div>
				) : (
					<PlansFeaturesMain
						site={ selectedSite || {} } // `PlanFeaturesMain` expects a default prop of `{}` if no site is provided
						hideFreePlan={ hideFreePlan }
						isInSignup={ true }
						isLaunchPage={ isLaunchPage }
						intervalType={ this.getIntervalType() }
						onUpgradeClick={ this.onSelectPlan }
						showFAQ={ false }
						displayJetpackPlans={ false }
						domainName={ this.getDomainName() }
						customerType={ this.getCustomerType() }
						disableBloggerPlanWithNonBlogDomain={ disableBloggerPlanWithNonBlogDomain }
						plansWithScroll={ isDesktop() }
						planTypes={ planTypes }
						flowName={ flowName }
						customHeader={ this.getGutenboardingHeader() }
						showTreatmentPlansReorderTest={ showTreatmentPlansReorderTest }
						isAllPaidPlansShown={ true }
						isInVerticalScrollingPlansExperiment={ isInVerticalScrollingPlansExperiment }
						shouldShowPlansFeatureComparison={ isDesktop() } // Show feature comparison layout in signup flow and desktop resolutions
						isReskinned={ isReskinned }
					/>
				) }
			</div>
		);
	}

	getHeaderText() {
		const { headerText, translate } = this.props;

		if ( isDesktop() ) {
			return translate( 'Choose a plan' );
		}

		return headerText || translate( "Pick a plan that's right for you." );
	}

	getSubHeaderText() {
		const { hideFreePlan, subHeaderText, translate } = this.props;

		if ( ! hideFreePlan ) {
			if ( isDesktop() ) {
				return translate(
					"Pick one that's right for you and unlock features that help you grow. Or {{link}}start with a free site{{/link}}.",
					{
						components: {
							link: <Button onClick={ this.handleFreePlanButtonClick } borderless={ true } />,
						},
					}
				);
			}

			return translate( 'Choose a plan or {{link}}start with a free site{{/link}}.', {
				components: {
					link: <Button onClick={ this.handleFreePlanButtonClick } borderless={ true } />,
				},
			} );
		}

		if ( isDesktop() ) {
			return translate( "Pick one that's right for you and unlock features that help you grow." );
		}

		return subHeaderText || translate( 'Choose a plan. Upgrade as you grow.' );
	}

	plansFeaturesSelection() {
		const {
			flowName,
			stepName,
			positionInFlow,
			translate,
			hasInitializedSitesBackUrl,
		} = this.props;

		const headerText = this.getHeaderText();
		const fallbackHeaderText = this.props.fallbackHeaderText || headerText;
		const subHeaderText = this.getSubHeaderText();
		const fallbackSubHeaderText = this.props.fallbackSubHeaderText || subHeaderText;

		let backUrl;
		let backLabelText;

		if ( 0 === positionInFlow && hasInitializedSitesBackUrl ) {
			backUrl = hasInitializedSitesBackUrl;
			backLabelText = translate( 'Back to My Sites' );
		}

		return (
			<>
				<StepWrapper
					flowName={ flowName }
					stepName={ stepName }
					positionInFlow={ positionInFlow }
					headerText={ headerText }
					fallbackHeaderText={ fallbackHeaderText }
					subHeaderText={ subHeaderText }
					fallbackSubHeaderText={ fallbackSubHeaderText }
					isWideLayout={ true }
					stepContent={ this.plansFeaturesList() }
					allowBackFirstStep={ !! hasInitializedSitesBackUrl }
					backUrl={ backUrl }
					backLabelText={ backLabelText }
					hideFormattedHeader={ !! this.getGutenboardingHeader() }
				/>
			</>
		);
	}

	render() {
		const classes = classNames( 'plans plans-step', {
			'in-vertically-scrolled-plans-experiment': this.props.isInVerticalScrollingPlansExperiment,
			'has-no-sidebar': true,
			'is-wide-layout': true,
		} );

		return <div className={ classes }>{ this.plansFeaturesSelection() }</div>;
	}
}

PlansStep.propTypes = {
	additionalStepData: PropTypes.object,
	disableBloggerPlanWithNonBlogDomain: PropTypes.bool,
	goToNextStep: PropTypes.func.isRequired,
	hideFreePlan: PropTypes.bool,
	selectedSite: PropTypes.object,
	stepName: PropTypes.string.isRequired,
	stepSectionName: PropTypes.string,
	customerType: PropTypes.string,
	translate: PropTypes.func.isRequired,
	planTypes: PropTypes.array,
	flowName: PropTypes.string,
	isTreatmentPlansReorderTest: PropTypes.bool,
};

/**
 * Checks if the domainItem picked in the domain step is a top level .blog domain -
 * we only want to make Blogger plan available if it is.
 *
 * @param {object} domainItem domainItem object stored in the "choose domain" step
 * @returns {boolean} is .blog domain registration
 */
export const isDotBlogDomainRegistration = ( domainItem ) => {
	if ( ! domainItem ) {
		return false;
	}
	const { is_domain_registration, meta } = domainItem;

	return is_domain_registration && getTld( meta ) === 'blog';
};

export default connect(
	(
		state,
		{ path, signupDependencies: { siteSlug, domainItem, plans_reorder_abtest_variation } }
	) => ( {
		// Blogger plan is only available if user chose either a free domain or a .blog domain registration
		disableBloggerPlanWithNonBlogDomain:
			domainItem && ! isSubdomain( domainItem.meta ) && ! isDotBlogDomainRegistration( domainItem ),
		// This step could be used to set up an existing site, in which case
		// some descendants of this component may display discounted prices if
		// they apply to the given site.
		selectedSite: siteSlug ? getSiteBySlug( state, siteSlug ) : null,
		customerType: parseQs( path.split( '?' ).pop() ).customerType,
		siteGoals: getSiteGoals( state ) || '',
		siteType: getSiteType( state ),
		hasInitializedSitesBackUrl: hasInitializedSites( state ) ? '/sites/' : false,
		showTreatmentPlansReorderTest:
			'treatment' === plans_reorder_abtest_variation || isTreatmentPlansReorderTest( state ),
		isLoadingExperiment: false,
		// IMPORTANT NOTE: The following is always set to true. It's a hack to resolve the bug reported
		// in https://github.com/Automattic/wp-calypso/issues/50896, till a proper cleanup and deploy of
		// treatment for the `vertical_plan_listing_v2` experiment is implemented.
		isInVerticalScrollingPlansExperiment: true,
	} ),
	{ recordTracksEvent, saveSignupStep, submitSignupStep }
)( localize( PlansStep ) );
